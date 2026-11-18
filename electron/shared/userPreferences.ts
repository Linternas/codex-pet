import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { petIdSchema } from "./petAssets.js";

export const petPreferencesSchema = z.object({
  appliedPetId: petIdSchema.nullable(),
  autoWalk: z.boolean().default(false),
});

export type PetPreferences = z.infer<typeof petPreferencesSchema>;

const defaultPetPreferences = {
  appliedPetId: null,
  autoWalk: false,
} as const satisfies PetPreferences;

export function resolvePetPreferencesPath(userDataDir: string): string {
  return join(userDataDir, "pet-preferences.json");
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function readPetPreferences(userDataDir: string): Promise<PetPreferences> {
  try {
    const rawPreferences = await readFile(resolvePetPreferencesPath(userDataDir), "utf8");
    const parsedJson: unknown = JSON.parse(rawPreferences);
    return petPreferencesSchema.parse(parsedJson);
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError || error instanceof z.ZodError) {
      return defaultPetPreferences;
    }

    throw error;
  }
}

export async function writePetPreferences(
  userDataDir: string,
  preferences: PetPreferences,
): Promise<void> {
  const preferencesPath = resolvePetPreferencesPath(userDataDir);
  const parsedPreferences = petPreferencesSchema.parse(preferences);

  await mkdir(dirname(preferencesPath), { recursive: true });
  await writeFile(preferencesPath, `${JSON.stringify(parsedPreferences, null, 2)}\n`, "utf8");
}
