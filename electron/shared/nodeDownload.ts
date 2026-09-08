import { z } from "zod";

const releasesSchema = z.array(
  z.object({
    version: z.string().regex(/^v\d+\.\d+\.\d+$/),
    lts: z.union([z.string(), z.literal(false)]),
    files: z.array(z.string()),
  }),
);

export function resolveNodeInstallerUrl(value: unknown): string {
  const release = releasesSchema
    .parse(value)
    .find((item) => item.lts !== false && item.files.includes("osx-x64-pkg"));
  if (release === undefined) throw new Error("Node.js LTS 설치 파일을 찾지 못했습니다.");
  return `https://nodejs.org/dist/${release.version}/node-${release.version}.pkg`;
}

export function resolveNodeArchive(value: unknown, arch: string) {
  if (arch !== "arm64" && arch !== "x64") throw new Error("지원하지 않는 Mac 아키텍처입니다.");
  const release = releasesSchema
    .parse(value)
    .find((item) => item.lts !== false && item.files.includes(`osx-${arch}-tar`));
  if (release === undefined) throw new Error("Node.js LTS 설치 파일을 찾지 못했습니다.");
  const filename = `node-${release.version}-darwin-${arch}.tar.gz`;
  const base = `https://nodejs.org/dist/${release.version}`;
  return { filename, url: `${base}/${filename}`, checksumsUrl: `${base}/SHASUMS256.txt` };
}

export function verifyNodeArchive(checksums: string, filename: string, digest: string): void {
  const expected = checksums
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find((parts) => parts[1] === filename)?.[0];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected) || expected !== digest) {
    throw new Error("Node.js 파일 검증에 실패했습니다. 다시 설치하세요.");
  }
}
