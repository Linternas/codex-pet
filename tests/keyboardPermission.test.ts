import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({ existsSync: () => true }));
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
import { spawn } from "node:child_process";
import {
  getKeyboardPermission,
  startGlobalKeyboardActivity,
  stopGlobalKeyboardActivity,
} from "../electron/main/keyboardActivity.js";

it.skipIf(process.platform !== "darwin")(
  "uses the keyboard process permission instead of the main app identity",
  () => {
    const monitor = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(),
    });
    vi.mocked(spawn).mockReturnValue(monitor as unknown as ReturnType<typeof spawn>);
    try {
      startGlobalKeyboardActivity("/fixture", () => undefined);
      expect(getKeyboardPermission()).toBeNull();
      monitor.stdout.write("ready\n");
      expect(getKeyboardPermission()).toBe(true);
      monitor.stdout.write("permission-required\n");
      expect(getKeyboardPermission()).toBe(false);
      monitor.stdout.write("ready\n");
      expect(getKeyboardPermission()).toBe(true);
      monitor.emit("close");
      expect(getKeyboardPermission()).toBeNull();
    } finally {
      stopGlobalKeyboardActivity();
    }
  },
);
