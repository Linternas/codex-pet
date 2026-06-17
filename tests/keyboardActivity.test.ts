import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveKeyboardMonitorPath,
  shouldRetryKeyboardMonitorAfterMessage,
} from "../electron/main/keyboardActivity.js";
import {
  keyboardMonitorMessages,
  parseKeyboardMonitorMessages,
} from "../electron/shared/keyboardActivity.js";

describe("keyboard activity", () => {
  it("Given helper output contains keyDown When parsed Then it counts as keyboard activity", () => {
    expect(parseKeyboardMonitorMessages("ready\nkeyDown\nkeyDown\n")).toEqual([
      keyboardMonitorMessages.ready,
      keyboardMonitorMessages.keyDown,
      keyboardMonitorMessages.keyDown,
    ]);
  });

  it("Given helper output contains unknown lines When parsed Then unknown lines are ignored", () => {
    expect(parseKeyboardMonitorMessages("noise\npermission-required\n")).toEqual([
      keyboardMonitorMessages.permissionRequired,
    ]);
  });

  it("Given the helper reports missing permission When handled Then keyboard monitoring is retried", () => {
    expect(shouldRetryKeyboardMonitorAfterMessage(keyboardMonitorMessages.permissionRequired)).toBe(
      true,
    );
    expect(shouldRetryKeyboardMonitorAfterMessage(keyboardMonitorMessages.ready)).toBe(false);
    expect(shouldRetryKeyboardMonitorAfterMessage(keyboardMonitorMessages.keyDown)).toBe(false);
  });

  it("Given the native helper checks accessibility When permission is missing Then it does not repeatedly prompt", async () => {
    const source = await readFile(new URL("../native/key-monitor/main.swift", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("kAXTrustedCheckOptionPrompt");
    expect(source).toContain("false");
    expect(source).not.toContain(
      "kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true",
    );
  });

  it("Given a bundled helper app exists When resolving monitor path Then the app executable is used", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "codex-pet-keyboard-"));
    const appExecutablePath = join(
      projectRoot,
      "dist-native",
      "Codex Pet Keyboard Monitor.app",
      "Contents",
      "MacOS",
      "codex-pet-key-monitor",
    );
    await mkdir(dirname(appExecutablePath), { recursive: true });
    await writeFile(appExecutablePath, "");

    expect(resolveKeyboardMonitorPath(projectRoot)).toBe(appExecutablePath);
  });
});
