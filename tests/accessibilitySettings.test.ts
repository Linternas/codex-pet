import { describe, expect, it } from "vitest";
import {
  type SystemCommandRunner,
  accessibilitySettingsUrl,
  openAccessibilitySettingsPanel,
} from "../electron/main/accessibilitySettings.js";

describe("Accessibility settings", () => {
  it("Given system open fails When opening Accessibility settings Then shell fallback is used", async () => {
    const commands: string[] = [];
    const openedUrls: string[] = [];
    const runCommand: SystemCommandRunner = async (command, args) => {
      commands.push(`${command} ${args.join(" ")}`);
      if (command === "/usr/bin/open") {
        throw new Error("open failed");
      }
    };

    await openAccessibilitySettingsPanel(
      {
        openExternal: async (url) => {
          openedUrls.push(url);
        },
      },
      { runCommand, wait: async () => undefined },
    );

    expect(openedUrls).toEqual([accessibilitySettingsUrl]);
    expect(commands).toContain(
      '/usr/bin/osascript -e tell application "System Settings" to activate',
    );
  });

  it("Given System Settings activation fails When opening Accessibility settings Then System Preferences is tried", async () => {
    const commands: string[] = [];
    const runCommand: SystemCommandRunner = async (command, args) => {
      commands.push(`${command} ${args.join(" ")}`);
      if (args.join(" ").includes("System Settings")) {
        throw new Error("activation failed");
      }
    };

    await openAccessibilitySettingsPanel(
      { openExternal: async () => undefined },
      { runCommand, wait: async () => undefined },
    );

    expect(commands).toContain(
      '/usr/bin/osascript -e tell application "System Preferences" to activate',
    );
  });
});
