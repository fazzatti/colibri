/** Stable recorder error codes. */
export enum Code {
  INVALID_CONFIGURATION = "TTO_REC_001",
  INVALID_ARTIFACT = "TTO_REC_002",
}
/** Base class for recorder configuration and artifact errors. */
export abstract class RecorderError extends Error {
  /** Error source identifier. */
  readonly source: string = "@colibri/test-tooling/recorder";
  /** Stable machine-readable error code. */
  readonly code: Code;
  /** Create the error while preserving the supplied cause. */
  constructor(args: { code: Code; message: string; cause?: unknown }) {
    super(args.message, { cause: args.cause });
    this.name = new.target.name;
    this.code = args.code;
  }
}
/** Invalid recorder limits or CLI/configuration arguments. */
export class INVALID_CONFIGURATION extends RecorderError {
  /** Create the error while preserving the supplied cause. */
  constructor(message: string) {
    super({ code: Code.INVALID_CONFIGURATION, message });
  }
}
/** Malformed, incompatible, or mixed-run evidence. */
export class INVALID_ARTIFACT extends RecorderError {
  /** Create the error while preserving the supplied cause. */
  constructor(message: string, options?: ErrorOptions) {
    super({ code: Code.INVALID_ARTIFACT, message, cause: options?.cause });
  }
}
/** Concrete error constructors keyed by stable code. */
export const ERROR_TTO_REC: {
  [Code.INVALID_CONFIGURATION]: typeof INVALID_CONFIGURATION;
  [Code.INVALID_ARTIFACT]: typeof INVALID_ARTIFACT;
} = {
  [Code.INVALID_CONFIGURATION]: INVALID_CONFIGURATION,
  [Code.INVALID_ARTIFACT]: INVALID_ARTIFACT,
};
