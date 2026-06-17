import { describe, expect, it } from "vitest";
import {
  clampOverlayScale,
  overlayDefaults,
  resolveOverlayBounds,
  resolveOverlayScaleFromWidth,
} from "../electron/shared/overlay.js";
import {
  animationTiming,
  defaultAnimationState,
  keyboardAnimationState,
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

  it("Given keyboard input When animation is requested Then waving is used", () => {
    expect(keyboardAnimationState).toBe("waving");
  });
});
