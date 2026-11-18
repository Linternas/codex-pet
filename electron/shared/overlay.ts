export const overlayDefaults = {
  baseWidth: 320,
  baseHeight: 390,
  defaultScale: 0.65,
  minScale: 0.45,
  maxScale: 1,
} as const;

export type OverlayBounds = {
  readonly width: number;
  readonly height: number;
};

export type OverlayPosition = { readonly x: number; readonly y: number };

export function clampOverlayPosition(
  bounds: OverlayBounds & OverlayPosition,
  workArea: OverlayBounds & OverlayPosition,
): OverlayPosition {
  return {
    x: Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - bounds.width)),
    y: Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - bounds.height)),
  };
}

export function clampOverlayScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return overlayDefaults.defaultScale;
  }

  return Math.min(overlayDefaults.maxScale, Math.max(overlayDefaults.minScale, scale));
}

export function resolveOverlayBounds(scale: number): OverlayBounds {
  const clampedScale = clampOverlayScale(scale);

  return {
    width: Math.round(overlayDefaults.baseWidth * clampedScale),
    height: Math.round(overlayDefaults.baseHeight * clampedScale),
  };
}

export function chooseAutoWalkTarget(
  bounds: OverlayBounds & OverlayPosition,
  workArea: OverlayBounds & OverlayPosition,
  random = Math.random,
): OverlayPosition {
  const width = Math.max(0, workArea.width - bounds.width);
  const height = Math.max(0, workArea.height - bounds.height);
  const leftHalf = bounds.x <= workArea.x + width / 2;
  // Cross into the opposite side before picking another destination.
  const x = (leftHalf ? 0.67 : 0.08) + random() * 0.25;
  let y = 0.1 + random() * 0.8;
  const currentY = height > 0 ? (bounds.y - workArea.y) / height : 0;
  if (Math.abs(currentY - y) < 0.15) y = ((y + 0.4) % 0.8) + 0.1;
  return {
    x: workArea.x + Math.round(width * x),
    y: workArea.y + Math.round(height * y),
  };
}

export function stepTowardAutoWalkTarget(
  position: OverlayPosition,
  target: OverlayPosition,
  step: number,
): OverlayPosition {
  const x = target.x - position.x;
  const y = target.y - position.y;
  const distance = Math.hypot(x, y);
  if (distance <= step) return target;
  return {
    x: position.x + Math.round((x * step) / distance),
    y: position.y + Math.round((y * step) / distance),
  };
}

export function resolveOverlayScaleFromWidth(width: number): number {
  return clampOverlayScale(width / overlayDefaults.baseWidth);
}
