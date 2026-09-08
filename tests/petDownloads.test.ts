import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveNodeInstallerUrl } from "../electron/shared/nodeDownload.js";
import {
  resolveLookPosition,
  resolveRestAnimation,
  resolveSpriteGrid,
  resolveSpritePosition,
} from "../electron/shared/petAnimation.js";
import {
  copyCodexPetToProject,
  deleteProjectPet,
  initializePetStorage,
  listProjectPets,
  readProjectPet,
  resolvePetPaths,
} from "../electron/shared/petAssets.js";
import { petManifestSchema } from "../electron/shared/petManifest.js";

const temporaryRoots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pet-download-test-"));
  temporaryRoots.push(root);
  return {
    homeDir: join(root, "home"),
    projectRoot: join(root, "app"),
    petsRoot: join(root, "user", "pets"),
  };
}
async function writePet(directory: string, id: string, version = 1) {
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "pet.json"),
    JSON.stringify({
      id,
      displayName: id,
      description: "test pet",
      spritesheetPath: "spritesheet.webp",
      spriteVersionNumber: version,
    }),
  );
  await writeFile(join(directory, "spritesheet.webp"), "test-image");
}

describe("downloaded pet lifecycle", () => {
  it("copies v2 into user storage, serves a stable protocol URL and deletes only the app copy", async () => {
    const options = await fixture();
    // Resolve the CLI source exactly as production does, without writing to a real Codex directory.
    const source = join(options.homeDir, ".codex", "pets", "test-pet");
    const paths = resolvePetPaths("test-pet", options);
    expect(paths.codexPetDir).toBe(source);
    await writePet(source, "test-pet", 2);
    const pet = await copyCodexPetToProject("test-pet", options);
    expect(pet.manifest.spriteVersionNumber).toBe(2);
    expect(pet.spriteUrl).toMatch(/^pet-asset:\/\/test-pet\/spritesheet.webp\?v=/);
    expect((await listProjectPets(options)).map((item) => item.manifest.id)).toEqual(["test-pet"]);
    await expect(copyCodexPetToProject("test-pet", options)).rejects.toThrow("이미 다운로드");
    await deleteProjectPet("test-pet", options);
    expect(await listProjectPets(options)).toEqual([]);
    expect(await readFile(join(source, "spritesheet.webp"), "utf8")).toBe("test-image");
  });
  it("does not publish partial downloads or leave staging directories after validation fails", async () => {
    const options = await fixture();
    await writePet(resolvePetPaths("broken", options).codexPetDir, "wrong-id");
    await expect(copyCodexPetToProject("broken", options)).rejects.toThrow("일치하지");
    expect(await readdir(options.petsRoot)).toEqual([]);
  });
  it("seeds once and preserves user deletions across restarts", async () => {
    const options = await fixture();
    await writePet(join(options.projectRoot, "public", "pets", "seed"), "seed");
    await initializePetStorage(options);
    expect(await listProjectPets(options)).toHaveLength(1);
    await deleteProjectPet("seed", options);
    await initializePetStorage(options);
    expect(await listProjectPets(options)).toEqual([]);
    await expect(
      access(join(options.projectRoot, "public", "pets", "seed", "pet.json")),
    ).resolves.toBeUndefined();
  });
  it("keeps valid pets visible when another manifest is corrupt", async () => {
    const options = await fixture();
    await writePet(join(options.petsRoot, "good"), "good");
    await writePet(join(options.petsRoot, "bad"), "bad");
    await writeFile(join(options.petsRoot, "bad", "pet.json"), "invalid json");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await listProjectPets(options)).map((pet) => pet.manifest.id)).toEqual(["good"]);
  });
  it("rejects traversal, unsupported sprite versions and mismatching IDs", async () => {
    const options = await fixture();
    expect(() => resolvePetPaths("../outside", options)).toThrow();
    await writePet(join(options.petsRoot, "bad"), "different");
    await expect(readProjectPet("bad", options)).rejects.toThrow("일치하지");
    expect(
      petManifestSchema.safeParse({
        id: "good",
        displayName: "Good",
        description: "Good",
        spritesheetPath: "../outside.webp",
      }).success,
    ).toBe(false);
  });
});

describe("sprite formats and events", () => {
  it("preserves legacy rows and correctly positions v2's standard animations", () => {
    expect(resolveSpriteGrid()).toEqual({ columns: 8, rows: 9 });
    expect(resolveSpriteGrid(2)).toEqual({ columns: 8, rows: 11 });
    expect(resolveSpritePosition("review", 0)).toEqual({ x: "0%", y: "100%" });
    expect(resolveSpritePosition("review", 0, 2)).toEqual({ x: "0%", y: "80%" });
    expect(resolveLookPosition(0)).toEqual({ x: "0%", y: "90%" });
    expect(resolveLookPosition(180)).toEqual({ x: "0%", y: "100%" });
    expect(resolveLookPosition(360)).toEqual(resolveLookPosition(0));
    expect(
      new Set(
        Array.from({ length: 16 }, (_, index) => JSON.stringify(resolveLookPosition(index * 22.5))),
      ).size,
    ).toBe(16);
  });
  it("enters waiting after inactivity and returns to idle on activity", () => {
    expect(resolveRestAnimation(1_000, 30_999)).toBe("idle");
    expect(resolveRestAnimation(1_000, 31_000)).toBe("waiting");
    expect(resolveRestAnimation(31_000, 31_100)).toBe("idle");
  });
});

describe("Node.js installation download", () => {
  it("chooses an official LTS macOS pkg instead of a newer Current release", () => {
    expect(
      resolveNodeInstallerUrl([
        { version: "v26.0.0", lts: false, files: ["osx-x64-pkg"] },
        { version: "v24.1.0", lts: "Krypton", files: ["osx-x64-pkg"] },
      ]),
    ).toBe("https://nodejs.org/dist/v24.1.0/node-v24.1.0.pkg");
    expect(() =>
      resolveNodeInstallerUrl([{ version: "v24.1.0", lts: "Krypton", files: [] }]),
    ).toThrow("찾지 못했습니다");
    expect(() =>
      resolveNodeInstallerUrl([{ version: "../../evil", lts: "Krypton", files: ["osx-x64-pkg"] }]),
    ).toThrow();
  });
});
