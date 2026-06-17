export const keyboardMonitorMessages = {
  ready: "ready",
  keyDown: "keyDown",
  permissionRequired: "permission-required",
  tapUnavailable: "tap-unavailable",
} as const;

export type KeyboardMonitorMessage =
  (typeof keyboardMonitorMessages)[keyof typeof keyboardMonitorMessages];

const knownKeyboardMonitorMessages = new Set<string>(Object.values(keyboardMonitorMessages));

export function parseKeyboardMonitorMessages(chunk: string): readonly KeyboardMonitorMessage[] {
  return chunk
    .split(/\r?\n/)
    .filter((line): line is KeyboardMonitorMessage => knownKeyboardMonitorMessages.has(line));
}
