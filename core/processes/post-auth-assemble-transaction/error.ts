import type { PostAuthAssembleTransactionInput } from "@/processes/post-auth-assemble-transaction/types.ts";
import { ProcessError } from "@/processes/error.ts";

/** Stable errors emitted by the post-auth-assemble-transaction process. */
export enum Code {
  UNEXPECTED_ERROR = "PAA_000",
  MISSING_ARG = "PAA_001",
}

/** Base class for post-auth assembly failures. */
export abstract class PostAuthAssembleTransactionError extends ProcessError<
  Code,
  PostAuthAssembleTransactionInput
> {
  /** Source identifier for post-auth assembly failures. */
  override readonly source =
    "@colibri/core/processes/post-auth-assemble-transaction";
}

/** Raised when post-auth assembly fails unexpectedly. */
export class UNEXPECTED_ERROR extends PostAuthAssembleTransactionError {
  /**
   * Creates an unexpected post-auth assembly error.
   *
   * @param input - Original process input.
   * @param cause - Underlying unexpected error.
   */
  constructor(input: PostAuthAssembleTransactionInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "Unexpected post-auth transaction assembly failure!",
      input,
      details: "See the underlying cause for additional details.",
      cause,
    });
  }
}

/** Raised when a required post-auth assembly field is missing. */
export class MISSING_ARG extends PostAuthAssembleTransactionError {
  /**
   * Creates a missing-argument error.
   *
   * @param input - Original process input.
   * @param argName - Missing argument name.
   */
  constructor(input: PostAuthAssembleTransactionInput, argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      input,
      details:
        `The argument '${argName}' is required for post-auth transaction assembly.`,
    });
  }
}

/** Post-auth assembly error constructors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
};
