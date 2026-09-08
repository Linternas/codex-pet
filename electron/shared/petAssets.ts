import { execFile } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { commandEnvironment } from "./commandEnvironment.js";
import { type PetView, petIdSchema, petManifestSchema } from "./petManifest.js";

const execFileAsync = promisify(execFile);

export {
  petIdSchema,
  petManifestSchema,
  petViewSchema,
  type PetManifest,
  type PetView,
} from "./petManifest.js";

export type PetPaths = {
  readonly codexPetDir: string;
  readonly projectPetDir: string;
  readonly projectManifestPath: string;
  readonly projectSpritePath: string;
};

export type PetAssetOptions = {
  readonly homeDir: string;
  readonly projectRoot: string;
  readonly petsRoot?: string;
};

export function resolvePetPaths(petId: string, options: PetAssetOptions): PetPaths {
  const parsedPetId = petIdSchema.parse(petId);
  const projectPetDir = join(
    options.petsRoot ?? join(options.projectRoot, "public", "pets"),
    parsedPetId,
  );

  const { CODEX_HOME: codexHome } = process.env;
  return {
    codexPetDir: join(codexHome || join(options.homeDir, ".codex"), "pets", parsedPetId),
    projectPetDir,
    projectManifestPath: join(projectPetDir, "pet.json"),
    projectSpritePath: join(projectPetDir, "spritesheet.webp"),
  };
}

export async function installCodexPet(petId: string): Promise<void> {
  const parsedPetId = petIdSchema.parse(petId);
  await execFileAsync("npx", ["--yes", "codex-pets", "add", parsedPetId], {
    windowsHide: true,
    env: commandEnvironment(),
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

export async function copyCodexPetToProject(
  petId: string,
  options: PetAssetOptions,
): Promise<PetView> {
  const paths = resolvePetPaths(petId, options);
  const parent = dirname(paths.projectPetDir);
  await mkdir(parent, { recursive: true });
  try {
    await access(paths.projectPetDir);
    throw new Error("이미 다운로드한 캐릭터입니다. 삭제 후 다시 다운로드하세요.");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const staging = await mkdtemp(join(parent, ".download-"));
  try {
    await cp(paths.codexPetDir, join(staging, petId), { recursive: true });
    await readProjectPet(petId, { ...options, petsRoot: staging });
    await access(join(staging, petId, "spritesheet.webp"));
    await rename(join(staging, petId), paths.projectPetDir);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return readProjectPet(petId, options);
}

export async function readProjectPet(petId: string, options: PetAssetOptions): Promise<PetView> {
  const paths = resolvePetPaths(petId, options);
  const rawManifest = await readFile(paths.projectManifestPath, "utf8");
  const parsedJson: unknown = JSON.parse(rawManifest);
  const manifest = petManifestSchema.parse(parsedJson);
  if (manifest.id !== petId) throw new Error(`캐릭터 ID가 일치하지 않습니다: ${petId}`);
  const revision =
    options.petsRoot === undefined ? "" : String((await stat(paths.projectSpritePath)).mtimeMs);

  return {
    manifest,
    spriteUrl:
      options.petsRoot === undefined
        ? `pets/${manifest.id}/${manifest.spritesheetPath}`
        : `pet-asset://${manifest.id}/spritesheet.webp?v=${revision}`,
  };
}

export async function listProjectPets(options: PetAssetOptions): Promise<readonly PetView[]> {
  const petsRoot = options.petsRoot ?? join(options.projectRoot, "public", "pets");
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

    try {
      pets.push(await readProjectPet(parsedPetId.data, options));
    } catch (error) {
      console.warn(`캐릭터를 불러올 수 없습니다: ${entry.name}`, error);
    }
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

// Seed bundled pets once. Deleted pets must stay deleted across restarts/updates.
export async function initializePetStorage(options: PetAssetOptions): Promise<void> {
  if (options.petsRoot === undefined) return;
  const marker = join(options.petsRoot, ".initialized");
  try {
    await access(marker);
    return;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  await mkdir(options.petsRoot, { recursive: true });
  await cp(join(options.projectRoot, "public", "pets"), options.petsRoot, {
    recursive: true,
    force: false,
  });
  await writeFile(marker, "1\n");
}
