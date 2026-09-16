import { ColibriError } from "@colibri/core/errors";

/** Stable, occurrence-specific identicon failure codes. */
export enum IdenticonCode {
  /** Input is not a valid checksummed G-address or C-address. */
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
  /** @deprecated Use a dedicated failure subclass; this constructor is retained for source compatibility. */
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

/** Invalid public key. Stable code `IDICON_001`. */
export class IdenticonInvalidPublicKeyError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.INVALID_PUBLIC_KEY, message, data, cause);
  }
}
/** Invalid options. Stable code `IDICON_002`. */
export class IdenticonInvalidOptionsError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.INVALID_OPTIONS, message, data, cause);
  }
}
/** Invalid size. Stable code `IDICON_003`. */
export class IdenticonInvalidSizeError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.INVALID_SIZE, message, data, cause);
  }
}
/** Invalid padding. Stable code `IDICON_004`. */
export class IdenticonInvalidPaddingError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.INVALID_PADDING, message, data, cause);
  }
}
/** Insufficient drawing area. Stable code `IDICON_005`. */
export class IdenticonInsufficientDrawingAreaError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.INSUFFICIENT_DRAWING_AREA, message, data, cause);
  }
}
/** Invalid saturation. Stable code `IDICON_006`. */
export class IdenticonInvalidSaturationError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.INVALID_SATURATION, message, data, cause);
  }
}
/** Invalid value. Stable code `IDICON_007`. */
export class IdenticonInvalidValueError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.INVALID_VALUE, message, data, cause);
  }
}
/** Invalid background. Stable code `IDICON_008`. */
export class IdenticonInvalidBackgroundError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.INVALID_BACKGROUND, message, data, cause);
  }
}
/** Invalid format. Stable code `IDICON_009`. */
export class IdenticonInvalidFormatError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.INVALID_FORMAT, message, data, cause);
  }
}
/** Png encoding failed. Stable code `IDICON_010`. */
export class IdenticonPngEncodingFailedError extends IdenticonError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, data?: unknown, cause?: unknown) {
    super(IdenticonCode.PNG_ENCODING_FAILED, message, data, cause);
  }
}
/** One concrete constructor for each stable Identicon error code. */
export const IdenticonErrors: {
  [IdenticonCode.INVALID_PUBLIC_KEY]: typeof IdenticonInvalidPublicKeyError;
  [IdenticonCode.INVALID_OPTIONS]: typeof IdenticonInvalidOptionsError;
  [IdenticonCode.INVALID_SIZE]: typeof IdenticonInvalidSizeError;
  [IdenticonCode.INVALID_PADDING]: typeof IdenticonInvalidPaddingError;
  [IdenticonCode.INSUFFICIENT_DRAWING_AREA]:
    typeof IdenticonInsufficientDrawingAreaError;
  [IdenticonCode.INVALID_SATURATION]: typeof IdenticonInvalidSaturationError;
  [IdenticonCode.INVALID_VALUE]: typeof IdenticonInvalidValueError;
  [IdenticonCode.INVALID_BACKGROUND]: typeof IdenticonInvalidBackgroundError;
  [IdenticonCode.INVALID_FORMAT]: typeof IdenticonInvalidFormatError;
  [IdenticonCode.PNG_ENCODING_FAILED]: typeof IdenticonPngEncodingFailedError;
} = {
  [IdenticonCode.INVALID_PUBLIC_KEY]: IdenticonInvalidPublicKeyError,
  [IdenticonCode.INVALID_OPTIONS]: IdenticonInvalidOptionsError,
  [IdenticonCode.INVALID_SIZE]: IdenticonInvalidSizeError,
  [IdenticonCode.INVALID_PADDING]: IdenticonInvalidPaddingError,
  [IdenticonCode.INSUFFICIENT_DRAWING_AREA]:
    IdenticonInsufficientDrawingAreaError,
  [IdenticonCode.INVALID_SATURATION]: IdenticonInvalidSaturationError,
  [IdenticonCode.INVALID_VALUE]: IdenticonInvalidValueError,
  [IdenticonCode.INVALID_BACKGROUND]: IdenticonInvalidBackgroundError,
  [IdenticonCode.INVALID_FORMAT]: IdenticonInvalidFormatError,
  [IdenticonCode.PNG_ENCODING_FAILED]: IdenticonPngEncodingFailedError,
};
