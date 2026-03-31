import type { AssembleTransactionInput } from "@/processes/assemble-transaction/types.ts";
import { ProcessError } from "@/processes/error.ts";
import { getOperationTypesFromTransaction } from "@/common/helpers/transaction.ts";

/**
 * Stable error codes emitted by the assemble-transaction process.
 */
export enum Code {
  UNEXPECTED_ERROR = "ASM_000",

  MISSING_ARG = "ASM_001",
  NOT_SMART_CONTRACT_TRANSACTION = "ASM_002",
  UNSUPPORTED_OPERATION = "ASM_003",
  FAILED_TO_ASSEMBLE_TRANSACTION = "ASM_004",
  FAILED_TO_BUILD_TRANSACTION = "ASM_005",
  FAILED_TO_BUILD_SOROBAN_DATA = "ASM_006",
}

/**
 * Base class for assemble-transaction process errors.
 */
export abstract class AssembleTransactionError extends ProcessError<
  Code,
  AssembleTransactionInput
> {
  /** Source identifier for assemble-transaction process failures. */
  override readonly source = "@colibri/core/processes/assemble-transaction";
}

/**
 * Raised when assemble-transaction fails unexpectedly.
 */
export class UNEXPECTED_ERROR extends AssembleTransactionError {
  /**
   * Creates an unexpected assemble-transaction error.
   *
   * @param input - Original process input.
   * @param cause - Underlying unexpected error.
   */
  constructor(input: AssembleTransactionInput, cause?: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred!",
      input,
      details: "See the underlying cause for additional details",
      cause,
    });
  }
}

/**
 * Raised when a required assemble-transaction argument is missing.
 */
export class MISSING_ARG extends AssembleTransactionError {
  /**
   * Creates a missing-argument error.
   *
   * @param input - Original process input.
   * @param argName - Missing argument name.
   */
  constructor(input: AssembleTransactionInput, argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details: `The argument '${argName}' is required but was not provided in the pipeline creation.`,
      input,
      cause: undefined,
    });
  }
}

/**
 * Raised when the provided transaction does not contain smart-contract operations.
 */
export class NOT_SMART_CONTRACT_TRANSACTION_ERROR extends AssembleTransactionError {
  /** Structured metadata describing the unsupported operation set. */
  override readonly meta: {
    data: {
      input: AssembleTransactionInput;
      operations: string[];
    };
    cause: null;
  };

  /**
   * Creates a non-smart-contract-transaction error.
   *
   * @param input - Original process input.
   */
  constructor(input: AssembleTransactionInput) {
    super({
      code: Code.NOT_SMART_CONTRACT_TRANSACTION,
      message: "The transaction is not a smart contract transaction!",
      input,
      details:
        "The transaction provided does not contain any smart contract operations.",
      cause: undefined,
    });

    this.meta = {
      data: {
        input,
        operations: getOperationTypesFromTransaction(input.transaction),
      },
      cause: null,
    };
  }
}

/**
 * Raised when an unsupported operation is encountered during assembly.
 */
export class UNSUPPORTED_OPERATION_ERROR extends AssembleTransactionError {
  /**
   * Creates an unsupported-operation error.
   *
   * @param input - Original process input.
   * @param opType - Unsupported operation type.
   */
  constructor(input: AssembleTransactionInput, opType: string) {
    super({
      code: Code.UNSUPPORTED_OPERATION,
      message: "Unsupported operation!",
      input,
      details: `Could not assemble the transaction with the unsupported operation of type '${opType}'. Operation must be of type 'invokeHostFunction'.`,
    });
  }
}

/**
 * Raised when the transaction cannot be assembled from simulation output.
 */
export class FAILED_TO_ASSEMBLE_TRANSACTION_ERROR extends AssembleTransactionError {
  /**
   * Creates a failed-assembly error.
   *
   * @param input - Original process input.
   * @param cause - Underlying assembly error.
   */
  constructor(input: AssembleTransactionInput, cause?: Error) {
    super({
      code: Code.FAILED_TO_ASSEMBLE_TRANSACTION,
      message: "Failed to assemble transaction!",
      input,
      details:
        "Something went wrong during assembly, verify the simulation details and original transaction.",
      cause,
    });
  }
}

/**
 * Raised when the post-assembly transaction build step fails.
 */
export class FAILED_TO_BUILD_TRANSACTION_ERROR extends AssembleTransactionError {
  /**
   * Creates a build failure after assembly.
   *
   * @param input - Original process input.
   * @param cause - Underlying build error.
   */
  constructor(input: AssembleTransactionInput, cause?: Error) {
    super({
      code: Code.FAILED_TO_BUILD_TRANSACTION,
      message: "Failed to build transaction!",
      input,
      details:
        "The transaction could not be built. This indicates that some inner parameters of the transaction could be invalid.",
      cause,
    });
  }
}

/**
 * Raised when Soroban data cannot be rebuilt during assembly.
 */
export class FAILED_TO_BUILD_SOROBAN_DATA_ERROR extends AssembleTransactionError {
  /**
   * Creates a Soroban-data build failure.
   *
   * @param input - Original process input.
   * @param cause - Underlying Soroban-data build error.
   */
  constructor(input: AssembleTransactionInput, cause?: Error) {
    super({
      code: Code.FAILED_TO_BUILD_SOROBAN_DATA,
      message: "Failed to build Soroban data!",
      input,
      details: "The Soroban data could not be built.",
      cause,
    });
  }
}

/**
 * Assemble-transaction error constructors indexed by stable code.
 */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.NOT_SMART_CONTRACT_TRANSACTION]: NOT_SMART_CONTRACT_TRANSACTION_ERROR,
  [Code.UNSUPPORTED_OPERATION]: UNSUPPORTED_OPERATION_ERROR,
  [Code.FAILED_TO_ASSEMBLE_TRANSACTION]: FAILED_TO_ASSEMBLE_TRANSACTION_ERROR,
  [Code.FAILED_TO_BUILD_TRANSACTION]: FAILED_TO_BUILD_TRANSACTION_ERROR,
  [Code.FAILED_TO_BUILD_SOROBAN_DATA]: FAILED_TO_BUILD_SOROBAN_DATA_ERROR,
};
