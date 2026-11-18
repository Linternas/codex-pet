import { describe, expect, it } from "vitest";
import {
  clampOverlayPosition,
  clampOverlayScale,
  overlayDefaults,
  resolveAutoWalkX,
  resolveOverlayBounds,
  resolveOverlayScaleFromWidth,
} from "../electron/shared/overlay.js";
import {
  animationTiming,
  defaultAnimationState,
  resolveAnimationFrameDurationMs,
  resolveDragAnimationState,
  resolveSpritePosition,
} from "../electron/shared/petAnimation.js";

describe("overlay sizing", () => {
  it("Given an invalid scale When clamped Then it returns the default scale", () => {
    expect(clampOverlayScale(Number.NaN)).toBe(overlayDefaults.defaultScale);
  });

  it("Given an oversized scale When clamped Then it does not exceed 100 percent", () => {
    expect(clampOverlayScale(2.4)).toBe(1);
  });

  it("Given a scale When bounds are resolved Then width and height follow the base ratio", () => {
    expect(resolveOverlayBounds(overlayDefaults.defaultScale)).toEqual({
      width: Math.round(overlayDefaults.baseWidth * overlayDefaults.defaultScale),
      height: Math.round(overlayDefaults.baseHeight * overlayDefaults.defaultScale),
    });
  });

  it("Given a resized overlay width When scale is resolved Then it clamps to the supported range", () => {
    expect(resolveOverlayScaleFromWidth(1)).toBe(overlayDefaults.minScale);
  });

  it("Given animation states When sprite positions are resolved Then they map to the requested rows", () => {
    expect(resolveSpritePosition("idle", 0)).toEqual({ x: "0%", y: "0%" });
    expect(resolveSpritePosition("run-right", 3)).toEqual({
      x: "42.857%",
      y: "12.5%",
    });
    expect(resolveSpritePosition("jumping", 7)).toEqual({
      x: "100%",
      y: "50%",
    });
    expect(resolveSpritePosition("review", 0)).toEqual({
      x: "0%",
      y: "100%",
    });
  });

  it("Given drag movement When resolved Then horizontal direction selects run state", () => {
    expect(resolveDragAnimationState(4)).toBe("run-right");
    expect(resolveDragAnimationState(-4)).toBe("run-left");
    expect(resolveDragAnimationState(0)).toBe("idle");
  });

  it("Given pet animation timing When configured Then frame changes stay calm", () => {
    expect(animationTiming.frameDurationMs).toBeGreaterThanOrEqual(700);
    expect(animationTiming.requestedAnimationDurationMs).toBeGreaterThanOrEqual(1400);
  });

  it("Given hover jumping When frame duration is resolved Then it animates faster than idle", () => {
    expect(resolveAnimationFrameDurationMs("jumping")).toBeLessThan(
      resolveAnimationFrameDurationMs("idle"),
    );
    expect(resolveAnimationFrameDurationMs("jumping")).toBeLessThanOrEqual(420);
  });

  it("Given no explicit action When overlay needs a fallback Then idle is the only default state", () => {
    expect(defaultAnimationState).toBe("idle");
    expect("ambientDurationMs" in animationTiming).toBe(false);
  });
});

it("limits walking to the current display's usable area, including negative coordinates", () => {
  const workArea = { x: -1200, y: 24, width: 1100, height: 800 };
  const bounds = { x: -1200, y: 300, width: 200, height: 240 };

  expect(resolveAutoWalkX(bounds, workArea, -2)).toBe(-1200);
  expect(resolveAutoWalkX(bounds, workArea, 2)).toBe(-1198);
  expect(resolveAutoWalkX({ ...bounds, x: -301 }, workArea, 2)).toBe(-300);
  expect(resolveAutoWalkX({ ...bounds, x: -300 }, workArea, 2)).toBe(-300);
  expect(resolveAutoWalkX({ ...bounds, y: 600 }, workArea, 2)).toBe(-1200);
});

it("returns a saved overlay to the selected display after a monitor disappears", () => {
  const bounds = { x: -1400, y: 990, width: 208, height: 254 };
  const workArea = { x: 0, y: 32, width: 1200, height: 800 };
  expect(clampOverlayPosition(bounds, workArea)).toEqual({ x: 0, y: 578 });
});
