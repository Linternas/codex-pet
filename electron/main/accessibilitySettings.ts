import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const accessibilitySettingsUrl =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
const settingsAppNames = ["System Settings", "System Preferences"] as const;
const settingsActivationDelayMs = 400;

export type ExternalOpener = {
  readonly openExternal: (url: string) => Promise<void>;
};

export type SystemCommandRunner = (command: string, args: readonly string[]) => Promise<void>;

type AccessibilitySettingsOptions = {
  readonly runCommand?: SystemCommandRunner;
  readonly wait?: (ms: number) => Promise<void>;
};

const runSystemCommand: SystemCommandRunner = async (command, args) => {
  await execFileAsync(command, [...args]);
};

async function activateApp(appName: string, runCommand: SystemCommandRunner): Promise<boolean> {
  try {
    await runCommand("/usr/bin/osascript", [
      "-e",
      `tell application ${JSON.stringify(appName)} to activate`,
    ]);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      return false;
    }

    throw error;
  }
}

async function openWithSystemCommand(runCommand: SystemCommandRunner): Promise<boolean> {
  try {
    await runCommand("/usr/bin/open", [accessibilitySettingsUrl]);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      return false;
    }

    throw error;
  }
}

async function waitForSettings(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function openAccessibilitySettingsPanel(
  shell: ExternalOpener,
  options: AccessibilitySettingsOptions = {},
): Promise<void> {
  const runCommand = options.runCommand ?? runSystemCommand;
  const wait = options.wait ?? waitForSettings;

  if (!(await openWithSystemCommand(runCommand))) {
    await shell.openExternal(accessibilitySettingsUrl);
  }
  await wait(settingsActivationDelayMs);

  for (const appName of settingsAppNames) {
    if (await activateApp(appName, runCommand)) {
      return;
    }
  }
}
