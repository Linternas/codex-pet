import { execFile } from "node:child_process";
import { access, cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  PetAssetError,
  commandFailureMessage,
  errorCode,
  isMissingPath,
} from "./petAssetErrors.js";
import { normalizeSpriteImage } from "./petImage.js";
import { type PetManifest, type PetView, petIdSchema, petManifestSchema } from "./petSchema.js";

export { PetAssetError };
export type { PetAssetErrorCode } from "./petAssetErrors.js";
export { petIdSchema, petManifestSchema, petViewSchema } from "./petSchema.js";
export type { PetManifest, PetView } from "./petSchema.js";

async function readManifestJson(path: string): Promise<unknown> {
  let rawManifest: string;
  try {
    rawManifest = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingPath(error)) {
      throw new PetAssetError("missing-manifest", `pet.json을 찾을 수 없습니다: ${path}`);
    }

    throw error;
  }

  try {
    return JSON.parse(rawManifest);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PetAssetError("invalid-manifest", `pet.json 형식이 올바르지 않습니다: ${path}`);
    }

    throw error;
  }
}

function parsePetManifest(rawManifest: unknown, path: string, expectedPetId: string): PetManifest {
  const parsedManifest = petManifestSchema.safeParse(rawManifest);
  if (!parsedManifest.success) {
    const fields = parsedManifest.error.issues
      .map((issue) => issue.path.join("."))
      .filter((field) => field.length > 0)
      .join(", ");
    const fieldMessage = fields.length > 0 ? ` (${fields})` : "";
    throw new PetAssetError(
      "invalid-manifest",
      `pet.json 필수 값이 올바르지 않습니다${fieldMessage}: ${path}`,
    );
  }

  if (parsedManifest.data.id !== expectedPetId) {
    throw new PetAssetError("invalid-manifest", `pet.json id가 요청한 pet id와 다릅니다: ${path}`);
  }

  return parsedManifest.data;
}

async function ensureSpriteFile(path: string): Promise<void> {
  try {
    await access(path);
  } catch (error) {
    if (isMissingPath(error)) {
      throw new PetAssetError("missing-spritesheet", `spritesheet을 찾을 수 없습니다: ${path}`);
    }

    throw error;
  }
}

export type PetCommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<{ readonly stdout: string; readonly stderr: string }>;

const runPetCommand: PetCommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      [...args],
      { encoding: "utf8", windowsHide: true },
      (error, stdout, stderr) => {
        if (error !== null) {
          reject(Object.assign(error, { stderr, stdout }));
          return;
        }

        resolve({ stderr, stdout });
      },
    );
  });

async function copyCodexPetDirectoryToProject(
  petId: string,
  options: PetAssetOptions,
): Promise<void> {
  const paths = resolvePetPaths(petId, options);
  await mkdir(paths.projectPetDir, { recursive: true });

  try {
    await cp(paths.codexPetDir, paths.projectPetDir, { recursive: true });
  } catch (error) {
    if (isMissingPath(error)) {
      throw new PetAssetError(
        "downloaded-pet-missing",
        `다운로드된 에셋 폴더를 찾을 수 없습니다: ${paths.codexPetDir}`,
      );
    }

    if (error instanceof Error) {
      throw new PetAssetError("copy-failed", `에셋 복사 실패: ${error.message}`);
    }

    throw error;
  }
}

export async function copyCodexPetFilesToProject(
  petId: string,
  options: PetAssetOptions,
): Promise<void> {
  await copyCodexPetDirectoryToProject(petId, options);
}

export type PetPaths = {
  readonly codexPetDir: string;
  readonly projectPetDir: string;
  readonly projectManifestPath: string;
  readonly projectSpritePath: string;
};

export type PetAssetOptions = {
  readonly homeDir: string;
  readonly projectRoot: string;
};

export function resolvePetPaths(petId: string, options: PetAssetOptions): PetPaths {
  const parsedPetId = petIdSchema.parse(petId);
  const projectPetDir = join(options.projectRoot, "public", "pets", parsedPetId);

  return {
    codexPetDir: join(options.homeDir, ".codex", "pets", parsedPetId),
    projectPetDir,
    projectManifestPath: join(projectPetDir, "pet.json"),
    projectSpritePath: join(projectPetDir, "spritesheet.webp"),
  };
}

export async function installCodexPet(petId: string): Promise<void> {
  const parsedPetId = petIdSchema.parse(petId);
  try {
    await runPetCommand("npx", ["--yes", "codex-pets", "add", parsedPetId]);
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new PetAssetError(
        "npx-missing",
        "npx를 찾을 수 없습니다. Node.js 설치 후 다시 시도하세요.",
      );
    }

    if (error instanceof Error) {
      throw new PetAssetError(
        "install-command-failed",
        `codex-pets add 실패: ${commandFailureMessage(error)}`,
      );
    }

    throw error;
  }
}

export async function copyCodexPetToProject(
  petId: string,
  options: PetAssetOptions,
): Promise<PetView> {
  await copyCodexPetFilesToProject(petId, options);
  return readProjectPet(petId, options);
}

export async function readProjectPet(petId: string, options: PetAssetOptions): Promise<PetView> {
  const paths = resolvePetPaths(petId, options);
  const parsedJson = await readManifestJson(paths.projectManifestPath);
  const manifest = parsePetManifest(parsedJson, paths.projectManifestPath, petId);
  const spritePath = join(paths.projectPetDir, manifest.spritesheetPath);
  await ensureSpriteFile(spritePath);
  await normalizeSpriteImage(spritePath);

  return {
    manifest,
    spriteUrl: `pets/${manifest.id}/${manifest.spritesheetPath}`,
  };
}

export async function listProjectPets(options: PetAssetOptions): Promise<readonly PetView[]> {
  const petsRoot = join(options.projectRoot, "public", "pets");
  let entries: readonly { readonly name: string; readonly isDirectory: () => boolean }[];

  try {
    entries = await readdir(petsRoot, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const pets: PetView[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const parsedPetId = petIdSchema.safeParse(entry.name);
    if (!parsedPetId.success) {
      continue;
    }

    pets.push(await readProjectPet(parsedPetId.data, options));
  }

  return pets.sort((left, right) => left.manifest.id.localeCompare(right.manifest.id));
}

export async function deleteProjectPet(petId: string, options: PetAssetOptions): Promise<void> {
  const paths = resolvePetPaths(petId, options);
  await rm(paths.projectPetDir, { recursive: true, force: true });
}

export async function ensureProjectPetParent(projectRoot: string): Promise<void> {
  await mkdir(dirname(join(projectRoot, "public", "pets", "guga", "pet.json")), {
    recursive: true,
  });
}
