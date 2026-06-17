import { spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { mkdirSync, rmSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_ICON_BASENAME = "Codex-Pet";
const DEFAULT_ICON_SOURCES = ["image1.png", "image1.jpg"];
const DEFAULT_ICON_BASE_SIZES = [16, 32, 128, 256, 512];
const PROJECT_ROOT = process.cwd();
const NORMALIZED_ICON_FILE_NAME = "build-icon-source.png";
const RUNTIME_ICON_FILE_NAME = "Codex-Pet.png";
const ICNS_TYPES_BY_SIZE = new Map([
  [16, "icp4"],
  [32, "icp5"],
  [64, "icp6"],
  [128, "ic07"],
  [256, "ic08"],
  [512, "ic09"],
  [1024, "ic10"],
]);
const ELECTRON_FALLBACK_ICON = join(
  PROJECT_ROOT,
  "node_modules",
  "electron",
  "dist",
  "Electron.app",
  "Contents",
  "Resources",
  "electron.icns",
);

function readCliArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--source") {
      const next = argv[index + 1];
      if (next !== undefined) {
        options.source = next;
        index += 1;
      }

      continue;
    }

    if (arg === "--output") {
      const next = argv[index + 1];
      if (next !== undefined) {
        options.output = next;
        index += 1;
      }

      continue;
    }

    if (arg === "--name") {
      const next = argv[index + 1];
      if (next !== undefined) {
        options.name = next;
        index += 1;
      }
    }
  }

  return options;
}

function resolveSource(options) {
  if (options.source !== undefined) {
    return options.source;
  }

  const fallbackSource = DEFAULT_ICON_SOURCES.find((candidate) => existsSync(candidate));
  if (fallbackSource !== undefined) {
    return fallbackSource;
  }

  throw new Error(
    "아이콘 소스가 없습니다. 프로젝트 루트의 `image1.png` 또는 `image1.jpg`를 두거나 --source로 지정하세요.",
  );
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} 실패`);
  }
}

function parseIconName(rawName) {
  const name = rawName?.trim();
  return name === "" ? DEFAULT_ICON_BASENAME : name || DEFAULT_ICON_BASENAME;
}

function resolveNormalizedSource(source) {
  if (source.toLowerCase().endsWith(".png")) {
    return { source, normalizedPath: null };
  }

  const output = join(PROJECT_ROOT, "build", NORMALIZED_ICON_FILE_NAME);
  run("sips", ["--setProperty", "format", "png", source, "--out", output]);
  return { source: output, normalizedPath: output };
}

function buildRuntimeIconSource(source, outPath) {
  // Keep a 1024px square runtime icon for the macOS menu bar tray fallback.
  run("sips", ["-s", "format", "png", "-z", "1024", "1024", source, "--out", outPath]);
}

function buildIconSetEntries() {
  return DEFAULT_ICON_BASE_SIZES.flatMap((size) => {
    const entries = [{ size, fileName: `icon_${size}x${size}.png` }];

    if (size !== 1024) {
      const scaled = size * 2;
      entries.push({ size: scaled, fileName: `icon_${size}x${size}@2x.png` });
    }

    return entries;
  });
}

function buildIconImages({ source, iconsetPath }) {
  const entries = buildIconSetEntries();
  const iconsetEntries = entries.map(({ size, fileName }) => ({
    size,
    target: join(iconsetPath, fileName),
  }));

  for (const { size, target } of iconsetEntries) {
    run("sips", ["-s", "format", "png", "-z", String(size), String(size), source, "--out", target]);
  }

  return iconsetEntries;
}

function writeManualIcns(iconsetEntries, outIconPath) {
  const uniqueEntries = new Map();
  for (const entry of iconsetEntries) {
    if (!uniqueEntries.has(entry.size)) {
      uniqueEntries.set(entry.size, entry.target);
    }
  }

  const chunks = [];
  for (const [size, target] of [...uniqueEntries.entries()].sort(([a], [b]) => a - b)) {
    const type = ICNS_TYPES_BY_SIZE.get(size);
    if (type === undefined) {
      continue;
    }

    const data = readFileSync(target);
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, "ascii");
    header.writeUInt32BE(data.length + header.length, 4);
    chunks.push(header, data);
  }

  const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const fileHeader = Buffer.alloc(8);
  fileHeader.write("icns", 0, 4, "ascii");
  fileHeader.writeUInt32BE(totalLength, 4);
  writeFileSync(outIconPath, Buffer.concat([fileHeader, ...chunks], totalLength));
}

function fallbackToElectronIcon(outIconPath) {
  if (!existsSync(ELECTRON_FALLBACK_ICON)) {
    throw new Error("iconutil 실패 + Electron 기본 아이콘이 없어 폴백할 수 없습니다.");
  }

  cpSync(ELECTRON_FALLBACK_ICON, outIconPath, { dereference: true });
}

function main() {
  const options = readCliArgs(process.argv.slice(2));
  const source = resolveSource(options);
  const normalized = resolveNormalizedSource(source);
  const iconName = parseIconName(options.name);
  const outIconPath = options.output ?? join(PROJECT_ROOT, "build", `${iconName}.icns`);
  const outImagePath = join(PROJECT_ROOT, "build", RUNTIME_ICON_FILE_NAME);
  const iconsetPath = join(PROJECT_ROOT, "build", `${iconName}.iconset`);

  mkdirSync(join(PROJECT_ROOT, "build"), { recursive: true });
  rmSync(iconsetPath, { recursive: true, force: true });
  mkdirSync(iconsetPath, { recursive: true });

  try {
    buildRuntimeIconSource(normalized.source, outImagePath);
    const iconsetEntries = buildIconImages({
      source: normalized.source,
      iconsetPath,
    });

    try {
      run("iconutil", ["-c", "icns", iconsetPath, "-o", outIconPath]);
      console.log(`Created ${outIconPath}`);
    } catch {
      writeManualIcns(iconsetEntries, outIconPath);
      console.log(`Created ${outIconPath} with manual icns writer`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("커스텀 아이콘 생성에 실패해 Electron 기본 아이콘으로 대체합니다.");
      console.error(error.message);
      fallbackToElectronIcon(outIconPath);
      console.log(`Fallback Created ${outIconPath}`);
    } else {
      throw error;
    }
  } finally {
    rmSync(iconsetPath, { recursive: true, force: true });
    if (normalized.normalizedPath !== null) {
      rmSync(normalized.normalizedPath, { force: true });
    }
  }
}

try {
  main();
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
}
