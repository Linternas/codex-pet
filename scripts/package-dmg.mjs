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
const codesignIdentity = process.env.CODEX_PET_CODESIGN_IDENTITY?.trim() || "-";
const shouldUseDeveloperId = codesignIdentity !== "-";
const shouldNotarize = process.env.CODEX_PET_NOTARIZE === "1";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? null : value;
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
  const args = shouldUseDeveloperId
    ? ["--force", "--deep", "--options", "runtime", "--timestamp", "--sign", codesignIdentity, path]
    : ["--force", "--deep", "--sign", codesignIdentity, path];
  run("codesign", args);
}

function verifyAppBundle(path) {
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", path]);
}

function signDmg(path) {
  if (!shouldUseDeveloperId) {
    return;
  }

  run("codesign", ["--force", "--timestamp", "--sign", codesignIdentity, path]);
}

function verifyDmg(path) {
  if (!shouldUseDeveloperId) {
    return;
  }

  run("codesign", ["--verify", "--strict", "--verbose=4", path]);
}

function notaryCredentialArgs() {
  const keyPath = readEnv("CODEX_PET_NOTARY_KEY_PATH");
  const keyId = readEnv("CODEX_PET_NOTARY_KEY_ID");
  const issuer = readEnv("CODEX_PET_NOTARY_ISSUER_ID");
  if (keyPath !== null && keyId !== null && issuer !== null) {
    return ["--key", keyPath, "--key-id", keyId, "--issuer", issuer];
  }

  const appleId = readEnv("CODEX_PET_NOTARY_APPLE_ID");
  const password = readEnv("CODEX_PET_NOTARY_PASSWORD");
  const teamId = readEnv("CODEX_PET_NOTARY_TEAM_ID");
  if (appleId !== null && password !== null && teamId !== null) {
    return ["--apple-id", appleId, "--password", password, "--team-id", teamId];
  }

  throw new Error("Notarization requires App Store Connect API key or Apple ID credentials.");
}

function notarizeDmg(path) {
  if (!shouldNotarize) {
    return;
  }
  if (!shouldUseDeveloperId) {
    throw new Error("Notarization requires CODEX_PET_CODESIGN_IDENTITY.");
  }

  run("xcrun", ["notarytool", "submit", path, "--wait", ...notaryCredentialArgs()]);
  run("xcrun", ["stapler", "staple", path]);
  run("spctl", [
    "--assess",
    "--type",
    "open",
    "--context",
    "context:primary-signature",
    "-v",
    path,
  ]);
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
copyResource("dist-native");
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

signAppBundle(appBundlePath);
verifyAppBundle(appBundlePath);

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
signDmg(dmgPath);
verifyDmg(dmgPath);
notarizeDmg(dmgPath);
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
