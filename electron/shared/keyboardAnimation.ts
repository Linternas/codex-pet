import type { PetAnimationState } from "./petAnimation.js";

export type KeyboardAnimationActivity = {
  lastKeyAt: number | null;
  greetingUntil: number;
};

export function recordKeyboardActivity(activity: KeyboardAnimationActivity, now: number): void {
  if (activity.lastKeyAt === null || now - activity.lastKeyAt >= 30_000) {
    activity.greetingUntil = now + 1_600;
  }
  activity.lastKeyAt = now;
}

export function resolveKeyboardAnimation(
  activity: KeyboardAnimationActivity,
  now: number,
): PetAnimationState | null {
  if (activity.lastKeyAt === null) return null;
  if (now < activity.greetingUntil) return "waving";
  const quietFor = now - activity.lastKeyAt;
  if (quietFor < 2_500) return "running";
  if (quietFor < 10_000) return "review";
  return null;
}
