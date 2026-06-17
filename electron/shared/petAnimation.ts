export const petAnimationStates = [
  "idle",
  "run-right",
  "run-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
] as const;

export type PetAnimationState = (typeof petAnimationStates)[number];

export const defaultAnimationState = "idle" as const;
export const keyboardAnimationState = "waving" as const;

export const spriteGrid = {
  columns: 8,
  rows: 9,
} as const;

export const animationTiming = {
  frameDurationMs: 1280,
  requestedAnimationDurationMs: 1600,
} as const;

export const animationFrameDurationsMs = {
  idle: animationTiming.frameDurationMs,
  "run-right": 640,
  "run-left": 640,
  waving: 900,
  jumping: 320,
  failed: animationTiming.frameDurationMs,
  waiting: animationTiming.frameDurationMs,
  running: 640,
  review: animationTiming.frameDurationMs,
} as const satisfies Record<PetAnimationState, number>;

const petAnimationRows: Record<PetAnimationState, number> = {
  idle: 0,
  "run-right": 1,
  "run-left": 2,
  waving: 3,
  jumping: 4,
  failed: 5,
  waiting: 6,
  running: 7,
  review: 8,
};

export type SpritePosition = {
  readonly x: string;
  readonly y: string;
};

function formatPercent(value: number): string {
  return `${Number(value.toFixed(3))}%`;
}

function clampFrameIndex(index: number, maxIndex: number): number {
  if (!Number.isFinite(index)) {
    return 0;
  }

  return Math.min(maxIndex, Math.max(0, Math.trunc(index)));
}

export function resolveSpritePosition(
  state: PetAnimationState,
  columnIndex: number,
): SpritePosition {
  const column = clampFrameIndex(columnIndex, spriteGrid.columns - 1);
  const row = resolveAnimationRow(state);

  return {
    x: formatPercent((column / (spriteGrid.columns - 1)) * 100),
    y: formatPercent((row / (spriteGrid.rows - 1)) * 100),
  };
}

export function resolveAnimationRow(state: PetAnimationState): number {
  return petAnimationRows[state];
}

function getRandomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function resolveIdleAnimationFrameDurationMs(): number {
  const sample = Math.random() * 100;

  if (sample < 10) {
    return getRandomInRange(1000, 1100);
  }

  if (sample < 30) {
    return getRandomInRange(1000, 1100);
  }

  if (sample < 80) {
    return getRandomInRange(1100, 1200);
  }

  return getRandomInRange(1200, 1300);
}

export function resolveAnimationFrameDurationMs(state: PetAnimationState): number {
  if (state === "idle") {
    return resolveIdleAnimationFrameDurationMs();
  }

  return animationFrameDurationsMs[state];
}

export function resolveDragAnimationState(deltaX: number): PetAnimationState {
  if (deltaX > 0) {
    return "run-right";
  }

  if (deltaX < 0) {
    return "run-left";
  }

  return "idle";
}
