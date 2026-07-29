import type { PostAuthAssembleTransactionInput } from "@/processes/post-auth-assemble-transaction/types.ts";
import { ProcessError } from "@/processes/error.ts";

/** Stable errors emitted by the post-auth-assemble-transaction process. */
export enum Code {
  UNEXPECTED_ERROR = "PAA_000",
  MISSING_TRANSACTION = "PAA_001",
  MISSING_AUTHORIZED_OPERATION = "PAA_002",
  MISSING_RESOURCE_FEE = "PAA_003",
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

/** Raised when the transaction is missing from post-auth assembly input. */
export class MISSING_TRANSACTION extends PostAuthAssembleTransactionError {
  /**
   * Creates a missing-transaction error.
   *
   * @param input - Original process input.
   */
  constructor(input: PostAuthAssembleTransactionInput) {
    super({
      code: Code.MISSING_TRANSACTION,
      message: "Missing required argument: transaction",
      input,
      details:
        "The transaction is required for post-auth transaction assembly.",
    });
  }
}

/** Raised when the authorized operation is missing from assembly input. */
export class MISSING_AUTHORIZED_OPERATION
  extends PostAuthAssembleTransactionError {
  /**
   * Creates a missing-authorized-operation error.
   *
   * @param input - Original process input.
   */
  constructor(input: PostAuthAssembleTransactionInput) {
    super({
      code: Code.MISSING_AUTHORIZED_OPERATION,
      message: "Missing required argument: authorizedOperation",
      input,
      details:
        "The authorized operation is required for post-auth transaction assembly.",
    });
  }
}

/** Raised when the resource fee is missing from post-auth assembly input. */
export class MISSING_RESOURCE_FEE extends PostAuthAssembleTransactionError {
  /**
   * Creates a missing-resource-fee error.
   *
   * @param input - Original process input.
   */
  constructor(input: PostAuthAssembleTransactionInput) {
    super({
      code: Code.MISSING_RESOURCE_FEE,
      message: "Missing required argument: resourceFee",
      input,
      details:
        "The resource fee is required for post-auth transaction assembly.",
    });
  }
}

/** Post-auth assembly error constructors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_TRANSACTION]: MISSING_TRANSACTION,
  [Code.MISSING_AUTHORIZED_OPERATION]: MISSING_AUTHORIZED_OPERATION,
  [Code.MISSING_RESOURCE_FEE]: MISSING_RESOURCE_FEE,
};
