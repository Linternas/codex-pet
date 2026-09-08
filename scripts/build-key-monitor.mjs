import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

if (process.platform !== "darwin") {
  console.log("Skipping macOS keyboard monitor build on non-darwin platform.");
  process.exit(0);
}

const projectRoot = process.cwd();
const sourcePath = join(projectRoot, "native", "key-monitor", "main.swift");
const legacyOutputPath = join(projectRoot, "dist-native", "codex-pet-key-monitor");
const outputPath = join(
  projectRoot,
  "dist-native",
  "Codex Pet Keyboard Monitor.app",
  "Contents",
  "MacOS",
  "codex-pet-key-monitor",
);
const infoPlistPath = join(
  projectRoot,
  "dist-native",
  "Codex Pet Keyboard Monitor.app",
  "Contents",
  "Info.plist",
);
const moduleCachePath = join(tmpdir(), "codex-pet-swift-module-cache");

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(moduleCachePath, { recursive: true });
rmSync(legacyOutputPath, { force: true });
writeFileSync(
  infoPlistPath,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Codex Pet Keyboard Monitor</string>
  <key>CFBundleExecutable</key>
  <string>codex-pet-key-monitor</string>
  <key>CFBundleIdentifier</key>
  <string>app.mingu.codex-pet.keyboard-monitor</string>
  <key>CFBundleName</key>
  <string>Codex Pet Keyboard Monitor</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.0.2</string>
  <key>CFBundleVersion</key>
  <string>0.0.2</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
`,
);

const result = spawnSync(
  "xcrun",
  ["swiftc", sourcePath, "-O", "-framework", "ApplicationServices", "-o", outputPath],
  {
    env: {
      ...process.env,
      CLANG_MODULE_CACHE_PATH: moduleCachePath,
      SWIFT_MODULE_CACHE_PATH: moduleCachePath,
    },
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
