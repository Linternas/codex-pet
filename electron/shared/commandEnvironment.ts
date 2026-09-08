import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const managedNodeRoot = join(
  homedir(),
  "Library",
  "Application Support",
  "Codex Pet",
  "runtime",
);

// Finder-launched applications do not inherit an interactive shell's PATH.
export function commandEnvironment(): NodeJS.ProcessEnv {
  const { PATH: inheritedPath } = process.env;
  const nvmRoot = join(homedir(), ".nvm", "versions", "node");
  const nvmBins = existsSync(nvmRoot)
    ? readdirSync(nvmRoot)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map((version) => join(nvmRoot, version, "bin"))
    : [];
  return {
    ...process.env,
    PATH: [
      ...new Set(
        [
          join(managedNodeRoot, "current", "bin"),
          ...(inheritedPath ?? "").split(":"),
          "/usr/local/bin",
          "/opt/homebrew/bin",
          ...nvmBins,
          "/usr/bin",
          "/bin",
        ].filter(Boolean),
      ),
    ].join(":"),
  };
}
