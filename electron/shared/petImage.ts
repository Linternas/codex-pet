import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  } catch (error) {
    if (error instanceof Error) {
      return null;
    }

    throw error;
  }
}

export async function normalizeSpriteImage(imagePath: string): Promise<void> {
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
  } catch (error) {
    if (error instanceof Error) {
      return;
    }

    throw error;
  }
}
