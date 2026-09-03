import { colorFromHue } from "@/core/color.ts";
import type { IdenticonColor, IdenticonOptions } from "@/core/types.ts";
import { IdenticonCode, IdenticonError } from "@/error/index.ts";

/** Validated shared rendering settings. */
export interface RenderSettings {
  size: number;
  padding: number;
  foreground: IdenticonColor;
  background: IdenticonColor | null;
}

/** Guards option containers before reading their fields. */
export const assertOptions = (options: unknown): void => {
  if (
    typeof options !== "object" || options === null || Array.isArray(options)
  ) {
    throw new IdenticonError(
      IdenticonCode.INVALID_OPTIONS,
      "Identicon options must be an object.",
    );
  }
};

const validateGeometry = (size: number, padding: number): void => {
  // Bound raster allocation to 64 MiB before handing data to the PNG encoder.
  if (!Number.isInteger(size) || size < 7 || size > 4096) {
    throw new IdenticonError(
      IdenticonCode.INVALID_SIZE,
      "Size must be an integer between 7 and 4096 pixels.",
      { size },
    );
  }
  if (!Number.isInteger(padding) || padding < 0) {
    throw new IdenticonError(
      IdenticonCode.INVALID_PADDING,
      "Padding must be a nonnegative integer.",
      { padding },
    );
  }
  if (size - padding * 2 < 7) {
    throw new IdenticonError(
      IdenticonCode.INSUFFICIENT_DRAWING_AREA,
      "Padding must leave at least seven pixels for the grid.",
      { size, padding },
    );
  }
};

const validateTheme = (saturation: number, value: number): void => {
  if (!Number.isFinite(saturation) || saturation < 0 || saturation > 1) {
    throw new IdenticonError(
      IdenticonCode.INVALID_SATURATION,
      "Saturation must be a finite number between 0 and 1.",
      { saturation },
    );
  }
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new IdenticonError(
      IdenticonCode.INVALID_VALUE,
      "Value must be a finite number between 0 and 1.",
      { value },
    );
  }
};

const parseBackground = (background: string): IdenticonColor | null => {
  if (background === "transparent") return null;
  if (typeof background !== "string" || !/^#[\da-f]{6}$/i.test(background)) {
    throw new IdenticonError(
      IdenticonCode.INVALID_BACKGROUND,
      'Background must be "transparent" or a six-digit #RRGGBB color.',
      { background },
    );
  }
  const rgb = Number.parseInt(background.slice(1), 16);
  return { r: (rgb >> 16) & 255, g: (rgb >> 8) & 255, b: rgb & 255 };
};

/** Resolves defaults identically for every renderer without mutating options. */
export const resolveOptions = (
  hue: number,
  options: IdenticonOptions,
): RenderSettings => {
  assertOptions(options);
  const {
    size = 210,
    padding = 0,
    background = "transparent",
    saturation = 0.7,
    value = 0.8,
  } = options;
  validateGeometry(size, padding);
  validateTheme(saturation, value);
  return {
    size,
    padding,
    foreground: colorFromHue(hue, saturation, value),
    background: parseBackground(background),
  };
};
