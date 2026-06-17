import { z } from "zod";
import { type ReleaseManifest, isReleaseNewer } from "./release.js";

export const updateCheckResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("not-configured"),
    message: z.string().min(1),
  }),
  z.object({
    kind: z.literal("current"),
    version: z.string().min(1),
    message: z.string().min(1),
  }),
  z.object({
    kind: z.literal("available"),
    version: z.string().min(1),
    downloadUrl: z.string().url(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("error"),
    message: z.string().min(1),
  }),
]);

export const updateDownloadRequestSchema = z.object({
  downloadUrl: z.string().url(),
});

export type UpdateCheckResult = z.infer<typeof updateCheckResultSchema>;
export type UpdateDownloadRequest = z.infer<typeof updateDownloadRequestSchema>;

export function resolveReleaseDownloadUrl(manifestUrl: string, manifest: ReleaseManifest): string {
  return new URL(manifest.fileName, manifestUrl).toString();
}

export function createUpdateCheckResult(
  currentVersion: string,
  manifestUrl: string,
  manifest: ReleaseManifest,
): UpdateCheckResult {
  if (!isReleaseNewer(currentVersion, manifest)) {
    return {
      kind: "current",
      version: manifest.version,
      message: `${manifest.version}이 최신 버전입니다.`,
    };
  }

  return {
    kind: "available",
    version: manifest.version,
    downloadUrl: resolveReleaseDownloadUrl(manifestUrl, manifest),
    sha256: manifest.sha256,
    size: manifest.size,
  };
}
