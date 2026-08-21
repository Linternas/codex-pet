import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type PetAssetError,
  copyCodexPetToProject,
  deleteProjectPet,
  listProjectPets,
  readProjectPet,
  resolvePetPaths,
} from "../electron/shared/petAssets.js";

describe("pet asset storage", () => {
  it("Given a guga pet installed by codex-pets When copied Then project assets are readable", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-pet-assets-"));
    const homeDir = join(tempRoot, "home");
    const projectRoot = join(tempRoot, "project");
    const codexPetDir = join(homeDir, ".codex", "pets", "guga");

    await mkdir(codexPetDir, { recursive: true });
    await writeFile(
      join(codexPetDir, "pet.json"),
      JSON.stringify({
        id: "guga",
        displayName: "咕嘎",
        description: "A test pet",
        spritesheetPath: "spritesheet.webp",
      }),
    );
    await writeFile(join(codexPetDir, "spritesheet.webp"), "sprite-bytes");

    const pet = await copyCodexPetToProject("guga", { homeDir, projectRoot });
    const paths = resolvePetPaths("guga", { homeDir, projectRoot });
    const copiedSprite = await readFile(paths.projectSpritePath, "utf8");

    expect(pet.manifest.displayName).toBe("咕嘎");
    expect(pet.spriteUrl).toBe("pets/guga/spritesheet.webp");
    expect(copiedSprite).toBe("sprite-bytes");
  });

  it("Given project assets exist When reading Then manifest and sprite URL are returned", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-pet-assets-"));
    const homeDir = join(tempRoot, "home");
    const projectRoot = join(tempRoot, "project");
    const projectPetDir = join(projectRoot, "public", "pets", "guga");

    await mkdir(projectPetDir, { recursive: true });
    await writeFile(
      join(projectPetDir, "pet.json"),
      JSON.stringify({
        id: "guga",
        displayName: "咕嘎",
        description: "A display pet",
        spritesheetPath: "spritesheet.webp",
      }),
    );
    await writeFile(join(projectPetDir, "spritesheet.webp"), "sprite-bytes");

    const pet = await readProjectPet("guga", { homeDir, projectRoot });

    expect(pet.manifest.description).toBe("A display pet");
    expect(pet.spriteUrl).toBe("pets/guga/spritesheet.webp");
  });

  it("Given a project asset is missing pet.json When reading Then the missing manifest path is reported", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-pet-assets-"));
    const homeDir = join(tempRoot, "home");
    const projectRoot = join(tempRoot, "project");
    const projectPetDir = join(projectRoot, "public", "pets", "guga");

    await mkdir(projectPetDir, { recursive: true });

    await expect(readProjectPet("guga", { homeDir, projectRoot })).rejects.toThrow(
      /pet\.json을 찾을 수 없습니다/,
    );
  });

  it("Given a project asset is missing spritesheet When reading Then the missing spritesheet path is reported", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-pet-assets-"));
    const homeDir = join(tempRoot, "home");
    const projectRoot = join(tempRoot, "project");
    const projectPetDir = join(projectRoot, "public", "pets", "guga");

    await mkdir(projectPetDir, { recursive: true });
    await writeFile(
      join(projectPetDir, "pet.json"),
      JSON.stringify({
        id: "guga",
        displayName: "咕嘎",
        description: "A display pet",
        spritesheetPath: "spritesheet.webp",
      }),
    );

    await expect(readProjectPet("guga", { homeDir, projectRoot })).rejects.toThrow(
      /spritesheet을 찾을 수 없습니다/,
    );
  });

  it("Given codex-pets did not create a local asset When copying Then the missing source folder is reported", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-pet-assets-"));
    const homeDir = join(tempRoot, "home");
    const projectRoot = join(tempRoot, "project");

    await expect(copyCodexPetToProject("guga", { homeDir, projectRoot })).rejects.toMatchObject({
      code: "downloaded-pet-missing",
    } satisfies Partial<PetAssetError>);
  });

  it("Given multiple project assets exist When listed Then valid pets are returned sorted", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-pet-assets-"));
    const homeDir = join(tempRoot, "home");
    const projectRoot = join(tempRoot, "project");

    await mkdir(join(projectRoot, "public", "pets", "zuzu"), { recursive: true });
    await mkdir(join(projectRoot, "public", "pets", "guga"), { recursive: true });
    await mkdir(join(projectRoot, "public", "pets", "Invalid_Name"), { recursive: true });
    await writeFile(
      join(projectRoot, "public", "pets", "zuzu", "pet.json"),
      JSON.stringify({
        id: "zuzu",
        displayName: "Zuzu",
        description: "Second pet",
        spritesheetPath: "spritesheet.webp",
      }),
    );
    await writeFile(join(projectRoot, "public", "pets", "zuzu", "spritesheet.webp"), "sprite-zuzu");
    await writeFile(
      join(projectRoot, "public", "pets", "guga", "pet.json"),
      JSON.stringify({
        id: "guga",
        displayName: "咕嘎",
        description: "First pet",
        spritesheetPath: "spritesheet.webp",
      }),
    );
    await writeFile(join(projectRoot, "public", "pets", "guga", "spritesheet.webp"), "sprite-guga");

    const pets = await listProjectPets({ homeDir, projectRoot });

    expect(pets.map((pet) => pet.manifest.id)).toEqual(["guga", "zuzu"]);
  });

  it("Given a project asset exists When deleted Then the project copy is removed", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-pet-assets-"));
    const homeDir = join(tempRoot, "home");
    const projectRoot = join(tempRoot, "project");
    const projectPetDir = join(projectRoot, "public", "pets", "guga");

    await mkdir(projectPetDir, { recursive: true });
    await writeFile(
      join(projectPetDir, "pet.json"),
      JSON.stringify({
        id: "guga",
        displayName: "咕嘎",
        description: "A removable pet",
        spritesheetPath: "spritesheet.webp",
      }),
    );

    await deleteProjectPet("guga", { homeDir, projectRoot });

    await expect(readProjectPet("guga", { homeDir, projectRoot })).rejects.toThrow();
  });
});
