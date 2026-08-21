export type PetAssetErrorCode =
  | "install-command-failed"
  | "npx-missing"
  | "downloaded-pet-missing"
  | "copy-failed"
  | "missing-manifest"
  | "invalid-manifest"
  | "missing-spritesheet";

export class PetAssetError extends Error {
  readonly code: PetAssetErrorCode;

  constructor(code: PetAssetErrorCode, message: string) {
    super(message);
    this.name = "PetAssetError";
    this.code = code;
  }
}

function hasProperty<Key extends string>(value: object, key: Key): value is Record<Key, unknown> {
  return key in value;
}

export function errorCode(error: unknown): string | null {
  if (error instanceof Error && hasProperty(error, "code") && typeof error.code === "string") {
    return error.code;
  }

  return null;
}

function stringErrorProperty(error: Error, key: "stderr" | "stdout"): string {
  if (!hasProperty(error, key) || typeof error[key] !== "string") {
    return "";
  }

  return error[key].trim();
}

export function commandFailureMessage(error: Error): string {
  const stderr = stringErrorProperty(error, "stderr");
  if (stderr.length > 0) {
    return stderr;
  }

  const stdout = stringErrorProperty(error, "stdout");
  if (stdout.length > 0) {
    return stdout;
  }

  return error.message;
}

export function isMissingPath(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}
