import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (process.platform !== "darwin") process.exit(0);
const root = process.cwd();
const config = JSON.parse(readFileSync(join(root, "build/sparkle.json"), "utf8"));
const cache = join(root, ".cache/sparkle", config.version);
const framework = join(cache, "Sparkle.framework");
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!existsSync(framework)) {
  mkdirSync(cache, { recursive: true });
  const archive = join(cache, "distribution.tar.xz");
  run("curl", [
    "-fL",
    `https://github.com/sparkle-project/Sparkle/releases/download/${config.version}/Sparkle-${config.version}.tar.xz`,
    "-o",
    archive,
  ]);
  if (createHash("sha256").update(readFileSync(archive)).digest("hex") !== config.sha256)
    throw new Error("Sparkle archive checksum mismatch");
  run("tar", ["-xf", archive, "-C", cache]);
}
const contents = join(root, "dist-native/Codex Pet Updater.app/Contents");
mkdirSync(join(contents, "MacOS"), { recursive: true });
mkdirSync(join(contents, "Frameworks"), { recursive: true });
rmSync(join(contents, "Frameworks/Sparkle.framework"), { recursive: true, force: true });
cpSync(framework, join(contents, "Frameworks/Sparkle.framework"), {
  recursive: true,
  verbatimSymlinks: true,
});
writeFileSync(
  join(contents, "Info.plist"),
  `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>app.mingu.codex-pet.updater</string>
<key>CFBundleName</key><string>Codex Pet Updater</string>
<key>CFBundleExecutable</key><string>codex-pet-updater</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSUIElement</key><true/>
</dict></plist>`,
);
run("xcrun", [
  "clang",
  "-fobjc-arc",
  "-O2",
  "-mmacosx-version-min=12.0",
  "-F",
  cache,
  "-framework",
  "Cocoa",
  "-framework",
  "Sparkle",
  "-Wl,-rpath,@executable_path/../Frameworks",
  join(root, "native/updater/main.m"),
  "-o",
  join(contents, "MacOS/codex-pet-updater"),
]);
mkdirSync(join(root, "docs/licenses"), { recursive: true });
writeFileSync(
  join(root, "docs/licenses/Sparkle.txt"),
  readFileSync(join(cache, "LICENSE"), "utf8").replace(/[ \t]+$/gm, ""),
);
