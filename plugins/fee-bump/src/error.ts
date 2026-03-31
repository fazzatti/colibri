import { PluginError } from "@colibri/core";

/**
 * Stable error codes emitted by the fee-bump plugin package.
 */
export enum Code {
  UNEXPECTED_ERROR = "PLG_FBP_000",
  MISSING_ARG = "PLG_FBP_001",
  NOT_A_TRANSACTION = "PLG_FBP_002",
}

/**
 * Base class for fee-bump plugin errors.
 */
export abstract class FeeBumpPluginError extends PluginError<Code, unknown> {
  /** Error source identifier for fee-bump plugin failures. */
  override readonly source = "@colibri/core/plugins/fee-bump";
}

/**
 * Raised when fee-bump plugin creation fails unexpectedly.
 */
export class UNEXPECTED_ERROR extends FeeBumpPluginError {
  /**
   * Creates an unexpected plugin error wrapper.
   *
   * @param cause - Underlying unexpected error.
   */
  constructor(cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message:
        "An unexpected error occurred while assembling the 'FeeBumpPlugin' pipeline!",
      details: "See the 'cause' for more details",
      cause,
      data: {},
    });
  }
}

/**
 * Raised when a required plugin argument is missing.
 */
export class MISSING_ARG extends FeeBumpPluginError {
  /**
   * Creates a missing-argument error.
   *
   * @param argName - Missing argument name.
   */
  constructor(argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details: `The argument '${argName}' is required but was not provided in the pipeline creation.`,
      data: {},
    });
  }
}

/**
 * Raised when the plugin receives a non-transaction payload.
 */
export class NOT_A_TRANSACTION extends FeeBumpPluginError {
  /** Structured metadata for invalid transaction payloads. */
  override readonly meta: {
    data: {
      transaction: unknown;
    };
    cause: null;
  };

  /**
   * Creates a transaction-shape validation error.
   *
   * @param transaction - Invalid transaction value.
   */
  constructor(transaction: unknown) {
    super({
      code: Code.NOT_A_TRANSACTION,
      message: `The provided transaction is not a valid Transaction object.`,
      details: `The argument 'transaction' is expected to be a valid Stellar Transaction object to be wrapped in a FeeBumpTransaction.`,
      data: {},
    });

    this.meta = { data: { transaction }, cause: null };
  }
}

/**
 * Fee-bump plugin errors indexed by stable code.
 */
export const ERROR_PLG_FBP = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.NOT_A_TRANSACTION]: NOT_A_TRANSACTION,
};
