/** RGB color with integer channels in the range 0–255. */
export interface IdenticonColor {
  /** Red channel. */
  readonly r: number;
  /** Green channel. */
  readonly g: number;
  /** Blue channel. */
  readonly b: number;
}

/** Seven rows of seven cells; true means a foreground cell. */
export type IdenticonMatrix = readonly (readonly boolean[])[];

/** Immutable data for an address's default reference-compatible identicon. */
export interface IdenticonData {
  /** Validated G-address, including its StrKey checksum. */
  readonly publicKey: string;
  /** Address-derived hue in the inclusive range 0–1. */
  readonly hue: number;
  /** Default RGB color, with saturation 0.7 and value 0.8. */
  readonly color: IdenticonColor;
  /** Vertically symmetric 7×7 grid, indexed as matrix[row][column]. */
  readonly matrix: IdenticonMatrix;
}

/** Presentation options shared by SVG and PNG. */
export interface IdenticonOptions {
  /** Final square image size in pixels, 7–4096. Defaults to 210. */
  size?: number;
  /** Integer inset on each edge; must leave at least 7 pixels. Defaults to 0. */
  padding?: number;
  /** Opaque #RRGGBB background, or "transparent" (the default). */
  background?: string;
  /** HSV saturation in the inclusive range 0–1. Defaults to 0.7. */
  saturation?: number;
  /** HSV value (brightness) in the inclusive range 0–1. Defaults to 0.8. */
  value?: number;
}

/** Presentation options and required data URL image format. */
export interface IdenticonDataUrlOptions extends IdenticonOptions {
  /** Image format to encode with its corresponding MIME type. */
  format: "svg" | "png";
}
