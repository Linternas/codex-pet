import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { overlayDefaults } from "./overlay.js";
import { petIdSchema } from "./petAssets.js";

export const petPreferencesSchema = z.object({
  appliedPetId: petIdSchema.nullable(),
  autoWalk: z.boolean().default(false),
  clickThrough: z.boolean().default(false).catch(false),
  agentProviders: z
    .object({ codex: z.boolean(), claude: z.boolean() })
    .default({ codex: false, claude: false })
    .catch({ codex: false, claude: false }),
  overlayScale: z
    .number()
    .min(overlayDefaults.minScale)
    .max(overlayDefaults.maxScale)
    .default(overlayDefaults.defaultScale)
    .catch(overlayDefaults.defaultScale),
  overlayPosition: z
    .object({ x: z.number().int().safe(), y: z.number().int().safe() })
    .optional()
    .catch(undefined),
});

export type PetPreferences = z.infer<typeof petPreferencesSchema>;

export const defaultPetPreferences = petPreferencesSchema.parse({ appliedPetId: null });

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
      return { ...defaultPetPreferences };
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
  const temporary = `${preferencesPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(parsedPreferences, null, 2)}\n`, "utf8");
    await rename(temporary, preferencesPath);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}
