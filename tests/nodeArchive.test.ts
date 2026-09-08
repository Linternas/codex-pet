import { describe, expect, it } from "vitest";
import { resolveNodeArchive, verifyNodeArchive } from "../electron/shared/nodeDownload.js";

describe("managed Node archive", () => {
  const releases = [
    { version: "v26.0.0", lts: false, files: ["osx-arm64-tar"] },
    { version: "v24.0.0", lts: "Krypton", files: ["osx-arm64-tar", "osx-x64-tar"] },
  ];
  it("chooses a compatible LTS archive and rejects unsupported architectures", () => {
    expect(resolveNodeArchive(releases, "arm64").url).toBe(
      "https://nodejs.org/dist/v24.0.0/node-v24.0.0-darwin-arm64.tar.gz",
    );
    expect(resolveNodeArchive(releases, "x64").filename).toContain("darwin-x64");
    expect(() => resolveNodeArchive(releases, "ia32")).toThrow();
    expect(() => resolveNodeArchive([], "arm64")).toThrow();
  });
  it("requires the exact filename and checksum before extraction", () => {
    const hash = "a".repeat(64);
    expect(() => verifyNodeArchive(`${hash}  node.tar.gz\n`, "node.tar.gz", hash)).not.toThrow();
    expect(() =>
      verifyNodeArchive(`${hash}  node.tar.gz`, "node.tar.gz", "b".repeat(64)),
    ).toThrow();
    expect(() => verifyNodeArchive(`${hash}  other.tar.gz`, "node.tar.gz", hash)).toThrow();
  });
});
