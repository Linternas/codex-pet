import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  appMetadata,
  compareVersions,
  createDmgFileName,
  createReleaseManifest,
  formatVersionTag,
  isReleaseNewer,
} from "../electron/shared/release.js";

describe("release metadata", () => {
  it("Given package metadata When checked Then the app version is v0.0.7", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );

    expect(packageJson.version).toBe(appMetadata.version);
    expect(formatVersionTag(appMetadata.version)).toBe("v0.0.7");
  });

  it("Given release coordinates When creating a DMG file name Then it includes version platform and arch", () => {
    expect(createDmgFileName("0.0.1", "darwin", "arm64")).toBe("Codex-Pet-v0.0.1-darwin-arm64.dmg");
  });

  it("Given release artifact metadata When creating a manifest Then it validates the sha256 hash", () => {
    const manifest = createReleaseManifest({
      version: "0.0.1",
      platform: "darwin",
      arch: "arm64",
      sha256: "a".repeat(64),
      size: 123,
      releaseDate: "2026-06-17T00:00:00.000Z",
    });

    expect(manifest).toEqual({
      version: "v0.0.1",
      fileName: "Codex-Pet-v0.0.1-darwin-arm64.dmg",
      sha256: "a".repeat(64),
      size: 123,
      releaseDate: "2026-06-17T00:00:00.000Z",
    });
  });

  it("Given current app version When checking release manifest Then newer versions are detected", () => {
    const manifest = createReleaseManifest({
      version: "0.0.8",
      platform: "darwin",
      arch: "arm64",
      sha256: "b".repeat(64),
      size: 456,
      releaseDate: "2026-06-17T00:00:00.000Z",
    });

    expect(compareVersions("0.0.2", "0.0.1")).toBeGreaterThan(0);
    expect(isReleaseNewer(appMetadata.version, manifest)).toBe(true);
  });

  it("Given the DMG package script When app contents are changed Then it re-signs and verifies the app bundle", async () => {
    const script = await readFile(new URL("../scripts/package-dmg.mjs", import.meta.url), "utf8");

    expect(script).toContain('run("codesign", [');
    expect(script).toContain('"--force"');
    expect(script).toContain('"--deep"');
    expect(script).toContain('"--sign"');
    expect(script).toContain('"-"');
    expect(script).toContain('"--verify"');
    expect(script.indexOf('run("codesign", [')).toBeLessThan(script.indexOf('run("hdiutil", ['));
  });

  it("Given the DMG package script When copying Electron app bundles Then framework symlinks are preserved", async () => {
    const script = await readFile(new URL("../scripts/package-dmg.mjs", import.meta.url), "utf8");

    expect(script).toContain("function copyAppBundle(");
    expect(script).toContain("verbatimSymlinks: true");
    expect(script).toContain(
      'copyAppBundle(join(projectRoot, "node_modules", "electron", "dist", "Electron.app"), appBundlePath)',
    );
    expect(script).toContain(
      "copyAppBundle(appBundlePath, join(dmgRootPath, `${appMetadata.name}.app`))",
    );
  });

  it("Given the DMG package script When resetting release output Then it preserves the release directory", async () => {
    const script = await readFile(new URL("../scripts/package-dmg.mjs", import.meta.url), "utf8");

    expect(script).toContain("function resetDirectory(");
    expect(script).toContain("resetDirectory(releaseDir)");
    expect(script).not.toContain("rmSync(releaseDir");
  });
});
