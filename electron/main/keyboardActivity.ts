import { type ChildProcessByStdio, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Readable } from "node:stream";
import {
  type KeyboardMonitorMessage,
  keyboardMonitorMessages,
  parseKeyboardMonitorMessages,
} from "../shared/keyboardActivity.js";
import { keyboardAnimationState } from "../shared/petAnimation.js";

type KeyboardAnimationSender = (state: typeof keyboardAnimationState) => void;
type KeyboardMonitorProcess = ChildProcessByStdio<null, Readable, Readable>;

let activeMonitor: KeyboardMonitorProcess | undefined;
let permissionRetryTimer: ReturnType<typeof setTimeout> | undefined;
const permissionRetryDelayMs = 2500;

function clearPermissionRetry(): void {
  if (permissionRetryTimer === undefined) {
    return;
  }

  clearTimeout(permissionRetryTimer);
  permissionRetryTimer = undefined;
}

export function shouldRetryKeyboardMonitorAfterMessage(message: KeyboardMonitorMessage): boolean {
  switch (message) {
    case keyboardMonitorMessages.permissionRequired:
      return true;
    case keyboardMonitorMessages.ready:
    case keyboardMonitorMessages.keyDown:
    case keyboardMonitorMessages.tapUnavailable:
      return false;
    default:
      assertNever(message);
  }
}

function schedulePermissionRetry(
  projectRoot: string,
  sendAnimation: KeyboardAnimationSender,
): void {
  if (permissionRetryTimer !== undefined) {
    return;
  }

  permissionRetryTimer = setTimeout(() => {
    permissionRetryTimer = undefined;
    startGlobalKeyboardActivity(projectRoot, sendAnimation);
  }, permissionRetryDelayMs);
}

function handleKeyboardMonitorMessage(
  message: KeyboardMonitorMessage,
  sendAnimation: KeyboardAnimationSender,
  projectRoot: string,
): void {
  if (shouldRetryKeyboardMonitorAfterMessage(message)) {
    schedulePermissionRetry(projectRoot, sendAnimation);
  }

  switch (message) {
    case keyboardMonitorMessages.ready:
      clearPermissionRetry();
      return;
    case keyboardMonitorMessages.keyDown:
      sendAnimation(keyboardAnimationState);
      return;
    case keyboardMonitorMessages.permissionRequired:
      console.warn(
        "Codex Pet needs macOS Accessibility permission for Codex Pet Keyboard Monitor.",
      );
      return;
    case keyboardMonitorMessages.tapUnavailable:
      console.warn("Codex Pet could not create the macOS keyboard event tap.");
      return;
    default:
      assertNever(message);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected keyboard monitor message: ${value}`);
}

export function resolveKeyboardMonitorPath(projectRoot: string): string {
  const appExecutablePath = join(
    projectRoot,
    "dist-native",
    "Codex Pet Keyboard Monitor.app",
    "Contents",
    "MacOS",
    "codex-pet-key-monitor",
  );
  if (existsSync(appExecutablePath)) {
    return appExecutablePath;
  }

  return join(projectRoot, "dist-native", "codex-pet-key-monitor");
}

export function startGlobalKeyboardActivity(
  projectRoot: string,
  sendAnimation: KeyboardAnimationSender,
): void {
  stopGlobalKeyboardActivity();
  if (process.platform !== "darwin") {
    return;
  }

  const monitorPath = resolveKeyboardMonitorPath(projectRoot);
  if (!existsSync(monitorPath)) {
    console.warn(`Codex Pet keyboard monitor is missing: ${monitorPath}`);
    return;
  }

  let bufferedOutput = "";
  const monitor = spawn(monitorPath, [], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  activeMonitor = monitor;
  monitor.on("close", () => {
    if (activeMonitor === monitor) {
      activeMonitor = undefined;
    }
  });
  monitor.stdout.setEncoding("utf8");
  monitor.stdout.on("data", (chunk: string) => {
    bufferedOutput += chunk;
    const lines = bufferedOutput.split(/\r?\n/);
    bufferedOutput = lines.pop() ?? "";
    for (const message of parseKeyboardMonitorMessages(lines.join("\n"))) {
      handleKeyboardMonitorMessage(message, sendAnimation, projectRoot);
    }
  });
  monitor.stderr.setEncoding("utf8");
  monitor.stderr.on("data", (chunk: string) => {
    console.warn(chunk.trim());
  });
}

export function stopGlobalKeyboardActivity(): void {
  clearPermissionRetry();
  if (activeMonitor === undefined) {
    return;
  }

  activeMonitor.kill();
  activeMonitor = undefined;
}
