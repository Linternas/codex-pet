import { z } from "zod";

export const petIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const petManifestSchema = z.object({
  id: petIdSchema,
  displayName: z.string().min(1),
  description: z.string().min(1),
  spritesheetPath: z.literal("spritesheet.webp"),
  spriteVersionNumber: z.union([z.literal(1), z.literal(2)]).optional(),
});

export type PetManifest = z.infer<typeof petManifestSchema>;

export const petViewSchema = z.object({
  manifest: petManifestSchema,
  spriteUrl: z.string().min(1),
});

export type PetView = z.infer<typeof petViewSchema>;
