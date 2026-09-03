import { ColibriError } from "@colibri/core";

/** Stable, occurrence-specific identicon failure codes. */
export enum IdenticonCode {
  /** Input is not a valid checksummed Ed25519 G-address. */
  INVALID_PUBLIC_KEY = "IDICON_001",
  /** Render options are not an object. */
  INVALID_OPTIONS = "IDICON_002",
  /** Size is not an integer in the supported range. */
  INVALID_SIZE = "IDICON_003",
  /** Padding is not a nonnegative integer. */
  INVALID_PADDING = "IDICON_004",
  /** Padding leaves insufficient room for the grid. */
  INSUFFICIENT_DRAWING_AREA = "IDICON_005",
  /** Saturation is not a finite value between zero and one. */
  INVALID_SATURATION = "IDICON_006",
  /** Brightness is not a finite value between zero and one. */
  INVALID_VALUE = "IDICON_007",
  /** Background is neither transparent nor a six-digit hex color. */
  INVALID_BACKGROUND = "IDICON_008",
  /** Data URL format is neither svg nor png. */
  INVALID_FORMAT = "IDICON_009",
  /** The PNG encoder rejected image data. */
  PNG_ENCODING_FAILED = "IDICON_010",
}

/** @internal Core error base retained without re-exporting Core. */
export class IdenticonErrorBase extends ColibriError<IdenticonCode> {}

/** Package errors following the shared Colibri error model. */
export class IdenticonError extends IdenticonErrorBase {
  /**
   * Creates a uniquely coded failure.
   * @param code - Stable failure identifier.
   * @param message - Explanation suitable for developers.
   * @param data - Offending option or other diagnostic context.
   * @param cause - Original failure, when wrapping an encoder error.
   */
  constructor(
    code: IdenticonCode,
    message: string,
    data?: unknown,
    cause?: unknown,
  ) {
    super({
      domain: "tools",
      source: "@colibri/identicon",
      code,
      message,
      meta: { data, cause },
    });
    this.name = `IdenticonError ${code}`;
  }
}
