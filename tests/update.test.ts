import { describe, expect, it } from "vitest";
import { createReleaseManifest } from "../electron/shared/release.js";
import { createUpdateCheckResult, resolveReleaseDownloadUrl } from "../electron/shared/update.js";

describe("update checks", () => {
  it("Given a manifest URL When resolving the DMG URL Then it uses the same release directory", () => {
    const manifest = createReleaseManifest({
      version: "0.0.2",
      platform: "darwin",
      arch: "arm64",
      sha256: "c".repeat(64),
      size: 789,
      releaseDate: "2026-06-17T00:00:00.000Z",
    });

    expect(
      resolveReleaseDownloadUrl(
        "https://github.com/owner/repo/releases/latest/download/latest-darwin-arm64.json",
        manifest,
      ),
    ).toBe(
      "https://github.com/owner/repo/releases/latest/download/Codex-Pet-v0.0.2-darwin-arm64.dmg",
    );
  });

  it("Given a newer manifest When creating an update check result Then it exposes an update button target", () => {
    const manifest = createReleaseManifest({
      version: "0.0.2",
      platform: "darwin",
      arch: "arm64",
      sha256: "d".repeat(64),
      size: 789,
      releaseDate: "2026-06-17T00:00:00.000Z",
    });

    expect(createUpdateCheckResult("0.0.1", "https://example.com/latest.json", manifest)).toEqual({
      kind: "available",
      version: "v0.0.2",
      downloadUrl: "https://example.com/Codex-Pet-v0.0.2-darwin-arm64.dmg",
      sha256: "d".repeat(64),
      size: 789,
    });
  });
});
