import { BuildVerificationError, Code } from "./base.ts";

/** Raised when mutually exclusive or invalid verifier options are supplied. */
export class InvalidVerifierOptionsError
  extends BuildVerificationError<Code.INVALID_VERIFIER_OPTIONS> {
  /** Creates an invalid verifier-options error. */
  constructor(details: string, data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.INVALID_VERIFIER_OPTIONS,
      source: "@colibri/build-verification/verifier",
      message: "Invalid verifier options",
      details,
      data,
    });
  }
}

/** Raised when target bytes are not a valid WebAssembly module. */
export class InvalidTargetWasmError
  extends BuildVerificationError<Code.INVALID_TARGET_WASM> {
  /** Creates an invalid-target-Wasm error. */
  constructor(cause: unknown) {
    super({
      code: Code.INVALID_TARGET_WASM,
      source: "@colibri/build-verification/core/metadata",
      message: "Invalid target wasm",
      details: "The target bytes could not be decoded as a WebAssembly module.",
      cause,
    });
  }
}

/** Raised when a `contractmetav0` section contains malformed XDR. */
export class MetadataDecodingFailedError
  extends BuildVerificationError<Code.METADATA_DECODING_FAILED> {
  /** Creates a metadata-XDR decoding error. */
  constructor(section: number, cause: unknown) {
    super({
      code: Code.METADATA_DECODING_FAILED,
      source: "@colibri/build-verification/core/metadata",
      message: "Failed to decode contract metadata",
      details:
        "A contractmetav0 section did not contain valid ordered SCMetaEntry XDR values.",
      data: { section },
      cause,
    });
  }
}

/** Raised when a scalar SEP-58 metadata key appears more than once. */
export class DuplicateSep58MetadataError
  extends BuildVerificationError<Code.DUPLICATE_SEP58_METADATA> {
  /** Creates a duplicate-metadata error. */
  constructor(key: string) {
    super({
      code: Code.DUPLICATE_SEP58_METADATA,
      source: "@colibri/build-verification/core/recipe",
      message: "Duplicate SEP-58 metadata",
      details: `The scalar SEP-58 metadata key "${key}" must occur once.`,
      data: { key },
    });
  }
}

/** Raised when authoritative or out-of-band build metadata is invalid. */
export class InvalidSep58MetadataError
  extends BuildVerificationError<Code.INVALID_SEP58_METADATA> {
  /** Creates an invalid metadata error for one exact field occurrence. */
  constructor(key: string, value: unknown, reason: string) {
    super({
      code: Code.INVALID_SEP58_METADATA,
      source: "@colibri/build-verification/core/recipe",
      message: "Invalid SEP-58 metadata",
      details: reason,
      data: { key, value },
    });
  }
}

/** Raised when out-of-band mode has no explicit recipe. */
export class MissingOutOfBandRecipeError
  extends BuildVerificationError<Code.MISSING_OUT_OF_BAND_RECIPE> {
  /** Creates a missing out-of-band recipe error. */
  constructor() {
    super({
      code: Code.MISSING_OUT_OF_BAND_RECIPE,
      source: "@colibri/build-verification/processes/validate-build-recipe",
      message: "Missing out-of-band build recipe",
      details:
        "Out-of-band verification requires a caller-supplied image and recipe.",
    });
  }
}

/** Raised when a runtime request violates the public discriminated union. */
export class InvalidVerificationInputError
  extends BuildVerificationError<Code.INVALID_VERIFICATION_INPUT> {
  /** Creates an invalid request-shape error. */
  constructor(data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.INVALID_VERIFICATION_INPUT,
      source: "@colibri/build-verification/pipelines/build-verification",
      message: "Invalid build-verification input",
      details:
        "The runtime input must select exactly one supported verification mode and include that mode's required fields.",
      data,
    });
  }
}
