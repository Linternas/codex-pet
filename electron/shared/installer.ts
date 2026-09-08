import { execFile } from "node:child_process";
import { z } from "zod";
import { commandEnvironment } from "./commandEnvironment.js";

export const nodeInstallInstructions = {
  homebrewInstallCommand:
    '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
  nodeInstallCommand: "brew install node",
} as const;

export const installerStatusSchema = z.discriminatedUnion("npxAvailable", [
  z.object({
    npxAvailable: z.literal(true),
    npxVersion: z.string().min(1),
    instructions: z.null(),
  }),
  z.object({
    npxAvailable: z.literal(false),
    npxVersion: z.null(),
    instructions: z.object({
      homebrewInstallCommand: z.string().min(1),
      nodeInstallCommand: z.string().min(1),
    }),
  }),
]);

export type InstallerStatus = z.infer<typeof installerStatusSchema>;

export type CommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<{ readonly stdout: string }>;

function unavailableInstallerStatus(): InstallerStatus {
  return {
    npxAvailable: false,
    npxVersion: null,
    instructions: nodeInstallInstructions,
  };
}

const runCommand: CommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      [...args],
      { encoding: "utf8", windowsHide: true, env: commandEnvironment(), timeout: 10_000 },
      (error, stdout) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve({ stdout });
      },
    );
  });

export async function resolveInstallerStatus(
  commandRunner: CommandRunner = runCommand,
): Promise<InstallerStatus> {
  try {
    const { stdout } = await commandRunner("npx", ["-v"]);
    const npxVersion = stdout.trim();
    if (npxVersion.length === 0) {
      return unavailableInstallerStatus();
    }

    return {
      npxAvailable: true,
      npxVersion,
      instructions: null,
    };
  } catch (error) {
    if (error instanceof Error) {
      return unavailableInstallerStatus();
    }

    throw error;
  }
}
