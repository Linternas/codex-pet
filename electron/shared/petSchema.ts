import { z } from "zod";

export const petIdSchema = z.string().regex(/^[a-z0-9-]+$/);

export const petManifestSchema = z.object({
  id: petIdSchema,
  displayName: z.string().min(1),
  description: z.string().min(1),
  spritesheetPath: z.string().min(1),
});

export type PetManifest = z.infer<typeof petManifestSchema>;

export const petViewSchema = z.object({
  manifest: petManifestSchema,
  spriteUrl: z.string().min(1),
});

export type PetView = z.infer<typeof petViewSchema>;
