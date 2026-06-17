import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  readPetPreferences,
  resolvePetPreferencesPath,
  writePetPreferences,
} from "../electron/shared/userPreferences.js";

describe("pet user preferences", () => {
  it("Given no saved preferences When read Then no pet is applied", async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), "codex-pet-preferences-"));

    await expect(readPetPreferences(userDataDir)).resolves.toEqual({ appliedPetId: null });
  });

  it("Given an applied pet is saved When preferences are read Then the pet id is restored", async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), "codex-pet-preferences-"));

    await writePetPreferences(userDataDir, { appliedPetId: "frieren" });

    await expect(readPetPreferences(userDataDir)).resolves.toEqual({ appliedPetId: "frieren" });
  });

  it("Given the userData directory is missing When preferences are written Then parent folders are created", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-pet-preferences-"));
    const userDataDir = join(tempRoot, "nested", "user-data");

    await writePetPreferences(userDataDir, { appliedPetId: "guga" });

    const savedPreferences = await stat(resolvePetPreferencesPath(userDataDir));

    expect(savedPreferences.isFile()).toBe(true);
  });
});
