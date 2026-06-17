import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const MAX_SPRITESHEET_WIDTH = 1536;
const MAX_SPRITESHEET_HEIGHT = 1872;

type ImageDimensions = {
  readonly width: number;
  readonly height: number;
};

function parseDimension(output: string, key: string): number | undefined {
  const match = output.match(new RegExp(`^\\s*${key}:\\s*(\\d+)`, "m"));
  if (match?.[1] === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function readImageDimensions(imagePath: string): Promise<ImageDimensions | null> {
  try {
    const result = await execFileAsync(
      "sips",
      ["-g", "pixelWidth", "-g", "pixelHeight", imagePath],
      {
        encoding: "utf8",
      },
    );

    const output =
      typeof result.stdout === "string" ? result.stdout : new TextDecoder().decode(result.stdout);
    const width = parseDimension(output, "pixelWidth");
    const height = parseDimension(output, "pixelHeight");
    if (width === undefined || height === undefined) {
      return null;
    }

    return { width, height };
  } catch {
    return null;
  }
}

async function normalizeSpriteImage(imagePath: string): Promise<void> {
  const dimensions = await readImageDimensions(imagePath);
  if (dimensions === null) {
    return;
  }

  const scale = Math.min(
    1,
    MAX_SPRITESHEET_WIDTH / dimensions.width,
    MAX_SPRITESHEET_HEIGHT / dimensions.height,
  );
  if (scale >= 1) {
    return;
  }

  const targetWidth = Math.max(1, Math.round(dimensions.width * scale));
  const targetHeight = Math.max(1, Math.round(dimensions.height * scale));

  try {
    await execFileAsync("sips", ["-z", String(targetHeight), String(targetWidth), imagePath]);
  } catch {
    return;
  }
}

export const petIdSchema = z.string().regex(/^[a-z0-9-]+$/);

export const petManifestSchema = z.object({
  id: petIdSchema,
  displayName: z.string().min(1),
  description: z.string().min(1),
  spritesheetPath: z.string().min(1),
});

export type PetManifest = z.infer<typeof petManifestSchema>;

export const petViewSchema = z.object({
  manifest: petManifestSchema,
  spriteUrl: z.string().min(1),
});

export type PetView = z.infer<typeof petViewSchema>;

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
  await execFileAsync("npx", ["--yes", "codex-pets", "add", parsedPetId], {
    windowsHide: true,
  });
}

export async function copyCodexPetToProject(
  petId: string,
  options: PetAssetOptions,
): Promise<PetView> {
  const paths = resolvePetPaths(petId, options);
  await mkdir(paths.projectPetDir, { recursive: true });
  await cp(paths.codexPetDir, paths.projectPetDir, { recursive: true });

  return readProjectPet(petId, options);
}

export async function readProjectPet(petId: string, options: PetAssetOptions): Promise<PetView> {
  const paths = resolvePetPaths(petId, options);
  const rawManifest = await readFile(paths.projectManifestPath, "utf8");
  const parsedJson: unknown = JSON.parse(rawManifest);
  const manifest = petManifestSchema.parse(parsedJson);
  await normalizeSpriteImage(join(paths.projectPetDir, manifest.spritesheetPath));

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
