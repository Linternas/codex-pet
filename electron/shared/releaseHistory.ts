import { z } from "zod";

export const releaseHistoryUrl = "https://github.com/Linternas/codex-pet/releases";
export const releaseHistoryApiUrl =
  "https://api.github.com/repos/Linternas/codex-pet/releases?per_page=100";

const publishedReleaseSchema = z.object({
  tag_name: z.string().min(1),
  name: z.string().nullable(),
  body: z.string().nullable(),
  published_at: z.string().datetime().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
});

export const releaseHistoryEntrySchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  notes: z.string(),
  publishedAt: z.string().datetime(),
  prerelease: z.boolean(),
});
export type ReleaseHistoryEntry = z.infer<typeof releaseHistoryEntrySchema>;
export const releaseHistoryResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready"), releases: z.array(releaseHistoryEntrySchema) }),
  z.object({ kind: z.literal("error"), message: z.string() }),
]);
export type ReleaseHistoryResult = z.infer<typeof releaseHistoryResultSchema>;

export function parseReleaseHistory(value: unknown): ReleaseHistoryEntry[] {
  return z
    .array(publishedReleaseSchema)
    .parse(value)
    .filter((release) => !release.draft && release.published_at !== null)
    .map((release) =>
      releaseHistoryEntrySchema.parse({
        version: release.tag_name,
        title: release.name?.trim() || release.tag_name,
        notes: release.body ?? "",
        publishedAt: release.published_at,
        prerelease: release.prerelease,
      }),
    )
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}
