import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const sparkleConfig = JSON.parse(readFileSync(join(projectRoot, "build/sparkle.json"), "utf8"));
const { appMetadata, createDmgFileName, createReleaseManifest } = await import(
  pathToFileURL(join(projectRoot, "dist-electron", "electron", "shared", "release.js")).toString()
);

const releaseDir = join(projectRoot, "release");
const appBundlePath = join(releaseDir, `${appMetadata.name}.app`);
const dmgRootPath = join(releaseDir, "dmg-root");
const resourcesAppPath = join(appBundlePath, "Contents", "Resources", "app");
const dmgFileName = createDmgFileName(appMetadata.version, process.platform, process.arch);
const dmgPath = join(releaseDir, dmgFileName);
const manifestPath = join(releaseDir, `latest-${process.platform}-${process.arch}.json`);
const iconFileName = "Codex-Pet.icns";
const iconPath = join(projectRoot, "build", iconFileName);
const runtimeIconFileName = "Codex-Pet.png";
const runtimeIconPath = join(projectRoot, "build", runtimeIconFileName);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyResource(name) {
  cpSync(join(projectRoot, name), join(resourcesAppPath, name), {
    dereference: true,
    recursive: true,
  });
}

function copyAppBundle(sourcePath, destinationPath) {
  cpSync(sourcePath, destinationPath, {
    recursive: true,
    verbatimSymlinks: true,
  });
}

function setPlistValue(plistPath, key, value) {
  run("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, plistPath]);
}

function fileSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resetDirectory(path) {
  mkdirSync(path, { recursive: true });
  for (const entry of readdirSync(path)) {
    rmSync(join(path, entry), {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100,
    });
  }
}

function signAppBundle(path) {
  run("codesign", ["--force", "--deep", "--sign", "-", path]);
}

function verifyAppBundle(path) {
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", path]);
}

resetDirectory(releaseDir);
mkdirSync(resourcesAppPath, { recursive: true });
mkdirSync(dmgRootPath, { recursive: true });

copyAppBundle(join(projectRoot, "node_modules", "electron", "dist", "Electron.app"), appBundlePath);

const infoPlistPath = join(appBundlePath, "Contents", "Info.plist");
setPlistValue(infoPlistPath, "CFBundleName", appMetadata.name);
setPlistValue(infoPlistPath, "CFBundleDisplayName", appMetadata.name);
setPlistValue(infoPlistPath, "CFBundleIdentifier", "app.mingu.codex-pet");
setPlistValue(infoPlistPath, "CFBundleShortVersionString", appMetadata.version);
setPlistValue(infoPlistPath, "CFBundleVersion", appMetadata.version);
setPlistValue(infoPlistPath, "CFBundleIconFile", "Codex-Pet");
run("/usr/libexec/PlistBuddy", ["-c", "Add :LSUIElement bool true", infoPlistPath]);

if (existsSync(iconPath)) {
  cpSync(iconPath, join(appBundlePath, "Contents", "Resources", iconFileName), {
    dereference: true,
  });
}
if (existsSync(runtimeIconPath)) {
  cpSync(runtimeIconPath, join(appBundlePath, "Contents", "Resources", runtimeIconFileName), {
    dereference: true,
  });
}

copyResource("dist");
copyResource("dist-electron");
copyAppBundle(join(projectRoot, "dist-native"), join(resourcesAppPath, "dist-native"));
mkdirSync(join(appBundlePath, "Contents/Helpers"), { recursive: true });
copyAppBundle(
  join(projectRoot, "dist-native/Codex Pet Updater.app"),
  join(appBundlePath, "Contents/Helpers/Codex Pet Updater.app"),
);
rmSync(join(resourcesAppPath, "dist-native/Codex Pet Updater.app"), {
  recursive: true,
  force: true,
});
cpSync(
  join(projectRoot, "docs/licenses/Sparkle.txt"),
  join(appBundlePath, "Contents/Resources/Sparkle-LICENSE.txt"),
);
copyResource("public");
copyResource("electron-main.cjs");
copyResource("electron-preload.cjs");
mkdirSync(join(resourcesAppPath, "node_modules"), { recursive: true });
cpSync(join(projectRoot, "node_modules", "zod"), join(resourcesAppPath, "node_modules", "zod"), {
  dereference: true,
  recursive: true,
});
writeFileSync(
  join(resourcesAppPath, "package.json"),
  `${JSON.stringify(
    {
      name: "codex-pet-mac",
      version: appMetadata.version,
      private: true,
      type: "module",
      main: "electron-main.cjs",
      dependencies: { zod: "^3.25.67" },
    },
    null,
    2,
  )}\n`,
);

for (const [key, type, value] of [
  ["SUFeedURL", "string", sparkleConfig.feedUrl],
  ["SUPublicEDKey", "string", sparkleConfig.publicKey],
  ["SUEnableAutomaticChecks", "bool", "false"],
  ["SUAutomaticallyUpdate", "bool", "false"],
  ["SUVerifyUpdateBeforeExtraction", "bool", "true"],
  ["SURequireSignedFeed", "bool", "true"],
])
  run("/usr/libexec/PlistBuddy", ["-c", `Add :${key} ${type} ${value}`, infoPlistPath]);

signAppBundle(appBundlePath);
verifyAppBundle(appBundlePath);

const zipPath = join(
  releaseDir,
  `Codex-Pet-v${appMetadata.version}-${process.platform}-${process.arch}.zip`,
);
run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appBundlePath, zipPath]);
run(process.execPath, [join(projectRoot, "scripts/create-appcast.mjs"), zipPath]);
copyAppBundle(appBundlePath, join(dmgRootPath, `${appMetadata.name}.app`));
symlinkSync("/Applications", join(dmgRootPath, "Applications"));
run("hdiutil", [
  "create",
  "-volname",
  appMetadata.name,
  "-srcfolder",
  dmgRootPath,
  "-ov",
  "-format",
  "UDZO",
  dmgPath,
]);
rmSync(dmgRootPath, { force: true, recursive: true });
rmSync(appBundlePath, { force: true, recursive: true });

const manifest = createReleaseManifest({
  version: appMetadata.version,
  platform: process.platform,
  arch: process.arch,
  sha256: fileSha256(dmgPath),
  size: statSync(dmgPath).size,
  releaseDate: new Date().toISOString(),
});
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Created ${dmgPath}`);
console.log(`Created ${manifestPath}`);
