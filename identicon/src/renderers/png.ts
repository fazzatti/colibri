import { encode } from "fast-png";
import type { IdenticonColor, IdenticonData } from "@/core/types.ts";
import type { RenderSettings } from "@/core/options.ts";
import { IdenticonCode, IdenticonError } from "@/error/index.ts";
import { type Cell, filledCells } from "@/renderers/geometry.ts";

const paint = (
  pixels: Uint8Array,
  size: number,
  cell: Cell,
  { r, g, b }: IdenticonColor,
): void => {
  for (let y = cell.y; y < cell.y + cell.height; y++) {
    for (let x = cell.x; x < cell.x + cell.width; x++) {
      const offset = (y * size + x) * 4;
      // Avoid allocating a temporary RGBA array for each pixel.
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = 255;
    }
  }
};

/** Encodes RGBA pixels, preserving the original encoder failure as a cause. */
export const encodePng = (size: number, pixels: Uint8Array): Uint8Array => {
  try {
    return encode({
      width: size,
      height: size,
      data: pixels,
      channels: 4,
      depth: 8,
    });
  } catch (cause) {
    throw new IdenticonError(
      IdenticonCode.PNG_ENCODING_FAILED,
      "Unable to encode the identicon as PNG.",
      { size },
      cause,
    );
  }
};

/** Renders validated data as RGBA PNG bytes without Canvas or Buffer. */
export const renderPng = (
  data: IdenticonData,
  settings: RenderSettings,
): Uint8Array => {
  const { size, background, foreground } = settings;
  const pixels = new Uint8Array(size * size * 4);
  if (background !== null) {
    paint(pixels, size, { x: 0, y: 0, width: size, height: size }, background);
  }
  for (const cell of filledCells(data.matrix, settings)) {
    paint(pixels, size, cell, foreground);
  }
  return encodePng(size, pixels);
};
