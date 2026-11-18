import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultPetPreferences,
  readPetPreferences,
  resolvePetPreferencesPath,
  writePetPreferences,
} from "../electron/shared/userPreferences.js";

describe("pet user preferences", () => {
  it("Given no saved preferences When read Then no pet is applied", async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), "codex-pet-preferences-"));

    await expect(readPetPreferences(userDataDir)).resolves.toEqual({
      ...defaultPetPreferences,
    });
  });

  it("Given an applied pet is saved When preferences are read Then the pet id is restored", async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), "codex-pet-preferences-"));

    await writePetPreferences(userDataDir, {
      ...defaultPetPreferences,
      appliedPetId: "frieren",
      autoWalk: true,
      clickThrough: true,
      overlayScale: 0.8,
      overlayPosition: { x: -400, y: 120 },
    });

    await expect(readPetPreferences(userDataDir)).resolves.toEqual({
      ...defaultPetPreferences,
      appliedPetId: "frieren",
      autoWalk: true,
      clickThrough: true,
      overlayScale: 0.8,
      overlayPosition: { x: -400, y: 120 },
    });
  });

  it("defaults auto walk off for preferences saved by an older version", async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), "codex-pet-preferences-"));
    await writeFile(
      resolvePetPreferencesPath(userDataDir),
      JSON.stringify({ appliedPetId: "guga" }),
    );
    await expect(readPetPreferences(userDataDir)).resolves.toEqual({
      ...defaultPetPreferences,
      appliedPetId: "guga",
    });
  });

  it("Given the userData directory is missing When preferences are written Then parent folders are created", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-pet-preferences-"));
    const userDataDir = join(tempRoot, "nested", "user-data");

    await writePetPreferences(userDataDir, { ...defaultPetPreferences, appliedPetId: "guga" });

    const savedPreferences = await stat(resolvePetPreferencesPath(userDataDir));

    expect(savedPreferences.isFile()).toBe(true);
  });
});
