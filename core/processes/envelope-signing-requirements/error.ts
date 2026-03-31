import type { EnvelopeSigningRequirementsInput } from "@/processes/envelope-signing-requirements/types.ts";
import { ProcessError } from "@/processes/error.ts";

/**
 * Stable error codes emitted by the envelope-signing-requirements process.
 */
export enum Code {
  UNEXPECTED_ERROR = "ESR_000",

  INVALID_TRANSACTION_TYPE = "ESR_001",

  FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX = "ESR_002",
  FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION = "ESR_003",
}

/**
 * Base class for envelope-signing-requirements process errors.
 */
export abstract class EnvelopeSigningRequirementsError extends ProcessError<
  Code,
  EnvelopeSigningRequirementsInput
> {
  /** Source identifier for envelope-signing-requirements process failures. */
  override readonly source =
    "@colibri/core/processes/envelope-signing-requirements";
}

/**
 * Raised when envelope-signing-requirements fails unexpectedly.
 */
export class UNEXPECTED_ERROR extends EnvelopeSigningRequirementsError {
  /**
   * Creates an unexpected envelope-signing-requirements error.
   *
   * @param input - Original process input.
   * @param cause - Underlying unexpected error.
   */
  constructor(input: EnvelopeSigningRequirementsInput, cause?: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred!",
      input,
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

/**
 * Raised when the provided transaction type is unsupported.
 */
export class INVALID_TRANSACTION_TYPE extends EnvelopeSigningRequirementsError {
  /**
   * Creates an invalid-transaction-type error.
   *
   * @param input - Original process input.
   */
  constructor(input: EnvelopeSigningRequirementsInput) {
    super({
      code: Code.INVALID_TRANSACTION_TYPE,
      message: "Invalid transaction type!",
      input,
      details:
        "The provided transaction type is not supported. Only Transaction or FeeBumpTransaction objects can be processed.",
    });
  }
}

/**
 * Raised when fee-bump signing requirements cannot be processed.
 */
export class FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX extends EnvelopeSigningRequirementsError {
  /**
   * Creates a fee-bump requirements processing error.
   *
   * @param input - Original process input.
   * @param e - Underlying processing error.
   */
  constructor(input: EnvelopeSigningRequirementsInput, e: Error) {
    super({
      code: Code.FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX,
      message:
        "Failed to process signing requirements for fee bump transaction!",
      input,
      details:
        "The fee bump transaction could not be processed successfully. Verify the underlying error under the 'cause' property.",
      cause: e,
    });
  }
}

/**
 * Raised when standard transaction signing requirements cannot be processed.
 */
export class FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION extends EnvelopeSigningRequirementsError {
  /**
   * Creates a transaction requirements processing error.
   *
   * @param input - Original process input.
   * @param e - Underlying processing error.
   */
  constructor(input: EnvelopeSigningRequirementsInput, e: Error) {
    super({
      code: Code.FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION,
      message: "Failed to process signing requirements for transaction!",
      input,
      details:
        "The transaction could not be processed successfully. Verify the underlying error under the 'cause' property.",
      cause: e,
    });
  }
}

/**
 * Envelope-signing-requirements error constructors indexed by stable code.
 */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.INVALID_TRANSACTION_TYPE]: INVALID_TRANSACTION_TYPE,
  [Code.FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX]:
    FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX,
  [Code.FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION]:
    FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION,
};
