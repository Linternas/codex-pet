import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  keyboardMonitorPermissionRequestArguments,
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

  it("Given the native helper checks accessibility When permission is missing Then it only prompts on explicit request", async () => {
    const source = await readFile(new URL("../native/key-monitor/main.swift", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("kAXTrustedCheckOptionPrompt");
    expect(source).toContain("shouldPromptForAccessibility");
    expect(source).not.toContain(
      "kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true",
    );
  });

  it("Given the native helper is launched for permission request When prompt flag is provided Then Accessibility prompt is enabled", async () => {
    const source = await readFile(new URL("../native/key-monitor/main.swift", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("--request-accessibility");
    expect(source).toContain("shouldPromptForAccessibility");
    expect(source).toContain(
      "kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: shouldPromptForAccessibility",
    );
  });

  it("Given Accessibility settings opens When requesting permission Then the helper prompt flag is used", () => {
    expect(keyboardMonitorPermissionRequestArguments).toEqual(["--request-accessibility"]);
  });

  it("Given the native helper app is built When preparing Accessibility trust Then the helper bundle is signed", async () => {
    const source = await readFile(new URL("../scripts/build-key-monitor.mjs", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("signHelperApp");
    expect(source).toContain('"codesign"');
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
