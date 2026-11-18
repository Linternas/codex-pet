import { z } from "zod";

export const appMetadata = {
  name: "Codex Pet",
  version: "0.0.9",
} as const;

export const releaseUpdateConfig = {
  manifestUrl: "",
} as const;

export const releaseManifestSchema = z.object({
  version: z.string().regex(/^v\d+\.\d+\.\d+$/),
  fileName: z.string().endsWith(".dmg"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().positive(),
  releaseDate: z.string().datetime(),
});

export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;

export function formatVersionTag(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

export function createDmgFileName(version: string, platform: string, arch: string): string {
  return `Codex-Pet-${formatVersionTag(version)}-${platform}-${arch}.dmg`;
}

export function createReleaseManifest(
  input: Omit<ReleaseManifest, "version" | "fileName"> & {
    readonly arch: string;
    readonly platform: string;
    readonly version: string;
  },
): ReleaseManifest {
  return releaseManifestSchema.parse({
    version: formatVersionTag(input.version),
    fileName: createDmgFileName(input.version, input.platform, input.arch),
    sha256: input.sha256,
    size: input.size,
    releaseDate: input.releaseDate,
  });
}

function parseVersionParts(version: string): readonly [number, number, number] {
  const normalizedVersion = version.replace(/^v/, "");
  const parsedVersion = z
    .tuple([z.coerce.number().int(), z.coerce.number().int(), z.coerce.number().int()])
    .parse(normalizedVersion.split("."));

  return parsedVersion;
}

export function compareVersions(leftVersion: string, rightVersion: string): number {
  const left = parseVersionParts(leftVersion);
  const right = parseVersionParts(rightVersion);

  for (const index of [0, 1, 2] as const) {
    const diff = left[index] - right[index];
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export function isReleaseNewer(currentVersion: string, manifest: ReleaseManifest): boolean {
  return compareVersions(manifest.version, currentVersion) > 0;
}
