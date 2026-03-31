import type { Operation } from "stellar-sdk";
import { AuthError } from "@/auth/error.ts";

/** Stable error codes emitted by classic operation threshold checks. */
export enum Code {
  UNEXPECTED_ERROR = "AUTH_COT_000",
  FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE = "AUTH_COT_001",
}

/** Metadata attached to classic-operation-threshold errors. */
export type MetaData = {
  operation: Operation;
};

/** Base error type for classic operation threshold evaluation failures. */
export abstract class ClassicOperationThresholdError extends AuthError<
  Code,
  MetaData
> {
  /** Stable source identifier for this auth requirement. */
  override readonly source =
    "@colibri/core/auth/requirements/classic-operation-threshold";
}

/** Raised when an unexpected error occurs during threshold evaluation. */
export class UNEXPECTED_ERROR extends ClassicOperationThresholdError {
  /**
   * Creates the error.
   *
   * @param operation Operation being evaluated.
   * @param cause Underlying unexpected failure.
   */
  constructor(operation: Operation, cause?: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "Unexpected error occurred!",
      data: {
        operation,
      },
      details: `An unexpected error occurred while processing the operation: ${operation.type}.`,
      cause,
    });
  }
}

/** Raised when the source account cannot be resolved to a signer target. */
export class FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE extends ClassicOperationThresholdError {
  /**
   * Creates the error.
   *
   * @param operation Operation being evaluated.
   * @param source Operation source account, when present.
   * @param cause Underlying failure.
   */
  constructor(operation: Operation, source?: string, cause?: Error) {
    super({
      code: Code.FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE,
      message: "Error identifying the source account!",
      data: {
        operation,
      },
      details: `When processing the signer requirement for an operation, it was not possible to identify the source account '${source}'. This is verified to identify the underlying G-Address or set as 'source-account' when none is defined.`,
      cause,
    });
  }
}

/** Classic-operation-threshold error constructors indexed by stable code. */
export const ERROR_AUTH_COT = {
  [Code.FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE]:
    FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE,
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
};
