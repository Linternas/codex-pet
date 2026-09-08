// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PetAnimationState } from "../electron/shared/petAnimation.js";

vi.mock("../src/frameDetection.js", () => ({
  createFallbackVisibleFrameColumns: () => Array.from({ length: 11 }, () => [0, 1, 2, 3]),
  detectVisibleFrameColumns: async () => Array.from({ length: 11 }, () => [0, 1, 2, 3]),
}));
let key: () => void;
let animation: (state: PetAnimationState) => void;
let tick: FrameRequestCallback;
let now: number;
function advance(milliseconds: number) {
  now += milliseconds;
  tick(now);
}
function state() {
  return document.querySelector("[data-overlay-sprite]")?.getAttribute("data-animation-state");
}
beforeEach(async () => {
  vi.resetModules();
  now = 100_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    tick = callback;
    return 1;
  });
  Object.defineProperty(window, "codexPet", {
    configurable: true,
    value: {
      onKeyboardActivity: (callback: () => void) => {
        key = callback;
      },
      onAnimationRequested: (callback: typeof animation) => {
        animation = callback;
      },
      onStateChanged: () => undefined,
      getState: async () => ({
        kind: "ready",
        state: {
          appliedPetId: "test",
          pets: [
            {
              manifest: { id: "test", displayName: "Test", spriteVersionNumber: 2 },
              spriteUrl: "test.webp",
            },
          ],
        },
      }),
    },
  });
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  const { renderOverlay } = await import("../src/overlay.js");
  renderOverlay(root);
  await Promise.resolve();
  await Promise.resolve();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("keyboard-driven overlay", () => {
  it("greets once during continuous typing, then works, reviews, rests and waits", () => {
    key();
    expect(state()).toBe("waving");
    advance(800);
    key();
    advance(800);
    key();
    expect(state()).toBe("running");
    advance(2_499);
    expect(state()).toBe("running");
    advance(1);
    expect(state()).toBe("review");
    key();
    expect(state()).toBe("running");
    advance(10_000);
    expect(state()).toBe("idle");
    advance(20_000);
    expect(state()).toBe("waiting");
    key();
    expect(state()).toBe("waving");
  });
  it("keeps manual actions ahead of typing without extending their duration on every key", () => {
    animation("jumping");
    key();
    expect(state()).toBe("jumping");
    advance(1_000);
    key();
    expect(state()).toBe("jumping");
    advance(601);
    expect(state()).toBe("running");
  });
  it("shows typing reactions while hovered and restores v2 gaze after typing ends", () => {
    document.querySelector(".overlay-shell")?.dispatchEvent(new Event("pointerenter"));
    expect(state()).toBe("looking");
    key();
    expect(state()).toBe("waving");
    advance(1_600);
    expect(state()).toBe("running");
    advance(8_400);
    expect(state()).toBe("looking");
  });
});
