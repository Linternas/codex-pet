// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentSession } from "../electron/shared/agentSessions.js";
import type { PetManagerState } from "../electron/shared/ipc.js";
import type { PetAnimationState } from "../electron/shared/petAnimation.js";

vi.mock("../src/frameDetection.js", () => ({
  createFallbackVisibleFrameColumns: () => Array.from({ length: 11 }, () => [0, 1, 2, 3]),
  detectVisibleFrameColumns: async () => Array.from({ length: 11 }, () => [0, 1, 2, 3]),
}));
let key: () => void;
let animation: (state: PetAnimationState) => void;
let tick: FrameRequestCallback;
let now: number;
let publishState: (state: PetManagerState) => void;
let publishSessions: (sessions: readonly AgentSession[]) => void;
let overlayState: PetManagerState;
const stepAutoWalk = vi.fn(async () => true);
const openAgentSessions = vi.fn(async () => undefined);
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
  stepAutoWalk.mockReset().mockResolvedValue(true);
  overlayState = {
    appliedPetId: "test",
    overlay: { autoWalk: false, visible: true, scale: 0.65, clickThrough: false },
    installer: { npxAvailable: true, npxVersion: "test", instructions: null },
    pets: [
      {
        manifest: {
          id: "test",
          displayName: "Test",
          spriteVersionNumber: 2,
          description: "Test pet",
          spritesheetPath: "spritesheet.webp",
        },
        spriteUrl: "test.webp",
      },
    ],
  };
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
      onStateChanged: (callback: typeof publishState) => {
        publishState = callback;
      },
      getState: async () => ({ kind: "ready", state: overlayState }),
      getAgentSessions: async () => [],
      onAgentSessions: (callback: typeof publishSessions) => {
        publishSessions = callback;
      },
      openAgentSessions,
      stepAutoWalk,
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

describe("sprite transitions", () => {
  it("fades the previous pose on state or character changes while sprite frames advance normally", async () => {
    const sprite = document.querySelector<HTMLElement>("[data-overlay-sprite]");
    const outgoing = document.querySelector<HTMLElement>("[data-outgoing-sprite]");
    if (!sprite || !outgoing) throw new Error("Missing transition layers");
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    Object.defineProperty(outgoing, "animate", { value: animate });

    const firstPosition = sprite.style.backgroundPosition;
    key();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(outgoing.style.backgroundPosition).toBe(firstPosition);
    advance(900);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(sprite.style.backgroundPosition).not.toBe(firstPosition);

    const original = overlayState.pets[0];
    if (!original) throw new Error("Missing test sprite");
    publishState({
      ...overlayState,
      pets: [{ ...original, spriteUrl: "second.webp" }],
    });
    expect(sprite.style.backgroundImage).toContain("test.webp");
    await Promise.resolve();
    expect(sprite.style.backgroundImage).toContain("second.webp");
    expect(outgoing.style.backgroundImage).toContain("test.webp");
    expect(animate).toHaveBeenCalledTimes(2);
  });
});

describe("desktop session card", () => {
  it("shows the task waiting for input, opens its list, and hides after completion", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const summary = document.querySelector<HTMLButtonElement>("[data-overlay-session]");
      if (!summary) throw new Error("Missing desktop session card");
      const codex: AgentSession = {
        provider: "codex",
        sessionId: "codex-1",
        project: "repo",
        task: "코드 수정 중",
        tool: "",
        status: "working",
        updatedAt: now,
      };
      const claude: AgentSession = {
        ...codex,
        provider: "claude",
        sessionId: "claude-2",
        task: "확인 대기 중",
        status: "waiting",
      };
      expect(summary.hidden).toBe(true);
      publishSessions([codex, claude]);
      expect(summary.hidden).toBe(false);
      expect(summary.textContent).toContain("Claude Code");
      expect(summary.textContent).toContain("확인 대기 중");
      expect(state()).toBe("review");
      summary.click();
      expect(openAgentSessions).toHaveBeenCalledOnce();

      publishSessions([{ ...claude, status: "completed" }]);
      expect(summary.textContent).toContain("응답 완료");
      vi.advanceTimersByTime(12_000);
      expect(summary.hidden).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("auto walk", () => {
  async function advanceWalk(ms: number) {
    advance(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  it("opts in, rests and reverses at an edge, and pauses for keyboard activity", async () => {
    await advanceWalk(10_000);
    expect(stepAutoWalk).not.toHaveBeenCalled();

    overlayState.overlay.autoWalk = true;
    publishState(overlayState);
    await advanceWalk(5_000);
    expect(stepAutoWalk).toHaveBeenLastCalledWith("run-right");
    expect(state()).toBe("run-right");

    stepAutoWalk.mockResolvedValueOnce(false);
    await advanceWalk(32);
    expect(state()).toBe("idle");
    await advanceWalk(4_999);
    expect(stepAutoWalk).toHaveBeenCalledTimes(2);
    await advanceWalk(1);
    expect(stepAutoWalk).toHaveBeenLastCalledWith("run-left");
    expect(state()).toBe("run-left");

    key();
    await advanceWalk(32);
    expect(stepAutoWalk).toHaveBeenCalledTimes(3);
    expect(state()).toBe("waving");

    overlayState.overlay.autoWalk = false;
    publishState(overlayState);
    await advanceWalk(20_000);
    expect(stepAutoWalk).toHaveBeenCalledTimes(3);
  });
});
