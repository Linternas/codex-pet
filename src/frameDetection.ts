import { spriteGrid } from "../electron/shared/petAnimation.js";

export type VisibleFrameColumns = readonly (readonly number[])[];

export function createFallbackVisibleFrameColumns(): VisibleFrameColumns {
  return Array.from({ length: spriteGrid.rows }, () => [0]);
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`Failed to load ${source}`)), {
      once: true,
    });
    image.src = source;
  });
}

function hasVisiblePixel(data: Uint8ClampedArray): boolean {
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 0) > 0) {
      return true;
    }
  }

  return false;
}

function detectColumnsForRow(
  context: CanvasRenderingContext2D,
  row: number,
  cellWidth: number,
  cellHeight: number,
): readonly number[] {
  const columns: number[] = [];
  for (let column = 0; column < spriteGrid.columns; column += 1) {
    const imageData = context.getImageData(
      column * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight,
    );
    if (hasVisiblePixel(imageData.data)) {
      columns.push(column);
    }
  }

  if (columns.length === 0) {
    return [0];
  }

  return columns;
}

export async function detectVisibleFrameColumns(spriteUrl: string): Promise<VisibleFrameColumns> {
  try {
    const image = await loadImage(spriteUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) {
      return createFallbackVisibleFrameColumns();
    }

    context.drawImage(image, 0, 0);
    const cellWidth = Math.floor(image.naturalWidth / spriteGrid.columns);
    const cellHeight = Math.floor(image.naturalHeight / spriteGrid.rows);

    return Array.from({ length: spriteGrid.rows }, (_value, row) =>
      detectColumnsForRow(context, row, cellWidth, cellHeight),
    );
  } catch (error) {
    if (error instanceof Error) {
      return createFallbackVisibleFrameColumns();
    }

    throw error;
  }
}
