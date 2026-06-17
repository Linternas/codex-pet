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

export function resolveOverlayScaleFromWidth(width: number): number {
  return clampOverlayScale(width / overlayDefaults.baseWidth);
}
