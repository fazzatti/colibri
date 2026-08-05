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
  INVALID_TRANSACTION_FEE_CONFIGURATION = "ASM_007",
  INVALID_BASE_FEE = "ASM_008",
  INVALID_INCLUSION_FEE = "ASM_009",
  INVALID_MAX_FEE = "ASM_010",
  BASE_FEE_TOO_LOW = "ASM_011",
  INCLUSION_FEE_TOO_LOW = "ASM_012",
  MAX_FEE_TOO_LOW = "ASM_013",
  TRANSACTION_FEE_TOO_HIGH = "ASM_014",
  TRANSACTION_FEE_BELOW_RESOURCE_FEE = "ASM_015",
  INVALID_RESOURCE_FEE = "ASM_016",
  RESOURCE_FEE_BELOW_SIMULATED_MINIMUM = "ASM_017",
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
      details:
        `The argument '${argName}' is required but was not provided in the pipeline creation.`,
      input,
      cause: undefined,
    });
  }
}

/**
 * Raised when the provided transaction does not contain smart-contract operations.
 */
export class NOT_SMART_CONTRACT_TRANSACTION_ERROR
  extends AssembleTransactionError {
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
      details:
        `Could not assemble the transaction with the unsupported operation of type '${opType}'. Operation must be of type 'invokeHostFunction'.`,
    });
  }
}

/**
 * Raised when the transaction cannot be assembled from simulation output.
 */
export class FAILED_TO_ASSEMBLE_TRANSACTION_ERROR
  extends AssembleTransactionError {
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
export class FAILED_TO_BUILD_TRANSACTION_ERROR
  extends AssembleTransactionError {
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
export class FAILED_TO_BUILD_SOROBAN_DATA_ERROR
  extends AssembleTransactionError {
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

/** Raised when an explicit fee object does not select exactly one mode. */
export class INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR
  extends AssembleTransactionError {
  /** Creates an invalid transaction-fee configuration error. */
  constructor(input: AssembleTransactionInput) {
    super({
      code: Code.INVALID_TRANSACTION_FEE_CONFIGURATION,
      message: "Invalid transaction fee configuration!",
      input,
      details:
        "The transaction fee must define exactly one of 'base', 'inclusion', or 'max'.",
    });
  }
}

/** Raised when an explicit base fee is not an integer string. */
export class INVALID_BASE_FEE_ERROR extends AssembleTransactionError {
  /** Creates an invalid base-fee error. */
  constructor(input: AssembleTransactionInput, value: unknown) {
    super({
      code: Code.INVALID_BASE_FEE,
      message: "Invalid base fee!",
      input,
      details: `The provided base fee '${
        String(value)
      }' must be a non-negative integer string in stroops.`,
    });
  }
}

/** Raised when an explicit inclusion fee is not an integer string. */
export class INVALID_INCLUSION_FEE_ERROR extends AssembleTransactionError {
  /** Creates an invalid inclusion-fee error. */
  constructor(input: AssembleTransactionInput, value: unknown) {
    super({
      code: Code.INVALID_INCLUSION_FEE,
      message: "Invalid inclusion fee!",
      input,
      details: `The provided inclusion fee '${
        String(value)
      }' must be a non-negative integer string in stroops.`,
    });
  }
}

/** Raised when an explicit maximum fee is not an integer string. */
export class INVALID_MAX_FEE_ERROR extends AssembleTransactionError {
  /** Creates an invalid maximum-fee error. */
  constructor(input: AssembleTransactionInput, value: unknown) {
    super({
      code: Code.INVALID_MAX_FEE,
      message: "Invalid maximum transaction fee!",
      input,
      details: `The provided maximum fee '${
        String(value)
      }' must be a non-negative integer string in stroops.`,
    });
  }
}

/** Raised when an explicit base fee is not positive. */
export class BASE_FEE_TOO_LOW_ERROR extends AssembleTransactionError {
  /** Creates a low-base-fee error. */
  constructor(input: AssembleTransactionInput, value: bigint) {
    super({
      code: Code.BASE_FEE_TOO_LOW,
      message: "Base fee is too low!",
      input,
      details: `The provided base fee '${value}' must be greater than zero.`,
    });
  }
}

/** Raised when an explicit inclusion fee is below the network minimum. */
export class INCLUSION_FEE_TOO_LOW_ERROR extends AssembleTransactionError {
  /** Creates a low-inclusion-fee error. */
  constructor(input: AssembleTransactionInput, value: bigint) {
    super({
      code: Code.INCLUSION_FEE_TOO_LOW,
      message: "Inclusion fee is too low!",
      input,
      details:
        `The provided inclusion fee '${value}' must be at least 100 stroops for a Soroban transaction.`,
    });
  }
}

/** Raised when a maximum fee cannot cover resources and minimum inclusion. */
export class MAX_FEE_TOO_LOW_ERROR extends AssembleTransactionError {
  /** Creates an insufficient maximum-fee error. */
  constructor(
    input: AssembleTransactionInput,
    value: bigint,
    resourceFee: bigint,
  ) {
    super({
      code: Code.MAX_FEE_TOO_LOW,
      message: "Maximum transaction fee is too low!",
      input,
      details:
        `The provided maximum fee '${value}' must cover the resource fee '${resourceFee}' plus at least 100 stroops of inclusion fee.`,
    });
  }
}

/** Raised when the assembled total exceeds the XDR uint32 limit. */
export class TRANSACTION_FEE_TOO_HIGH_ERROR extends AssembleTransactionError {
  /** Creates an excessive transaction-fee error. */
  constructor(input: AssembleTransactionInput, value: bigint) {
    super({
      code: Code.TRANSACTION_FEE_TOO_HIGH,
      message: "Transaction fee is too high!",
      input,
      details:
        `The assembled transaction fee '${value}' exceeds the maximum uint32 value supported by Stellar transaction XDR.`,
    });
  }
}

/** Raised when the input transaction fee is lower than its embedded resources. */
export class TRANSACTION_FEE_BELOW_RESOURCE_FEE_ERROR
  extends AssembleTransactionError {
  /** Creates an inconsistent transaction-fee error. */
  constructor(
    input: AssembleTransactionInput,
    transactionFee: bigint,
    resourceFee: bigint,
  ) {
    super({
      code: Code.TRANSACTION_FEE_BELOW_RESOURCE_FEE,
      message: "Transaction fee is lower than its resource fee!",
      input,
      details:
        `The transaction fee '${transactionFee}' cannot contain the embedded resource fee '${resourceFee}'.`,
    });
  }
}

/** Raised when an explicit resource-fee override is not an integer string. */
export class INVALID_RESOURCE_FEE_ERROR extends AssembleTransactionError {
  /** Creates an invalid resource-fee error. */
  constructor(input: AssembleTransactionInput, value: unknown) {
    super({
      code: Code.INVALID_RESOURCE_FEE,
      message: "Invalid resource fee!",
      input,
      details: `The provided resource fee '${
        String(value)
      }' must be a non-negative integer string in stroops.`,
    });
  }
}

/** Raised when an override is below the simulation-derived resource fee. */
export class RESOURCE_FEE_BELOW_SIMULATED_MINIMUM_ERROR
  extends AssembleTransactionError {
  /** Creates an insufficient resource-fee override error. */
  constructor(
    input: AssembleTransactionInput,
    value: bigint,
    simulatedMinimum: bigint,
  ) {
    super({
      code: Code.RESOURCE_FEE_BELOW_SIMULATED_MINIMUM,
      message: "Resource fee is below the simulated minimum!",
      input,
      details:
        `The provided resource fee '${value}' cannot be lower than the simulation-derived resource fee '${simulatedMinimum}'.`,
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
  [Code.INVALID_TRANSACTION_FEE_CONFIGURATION]:
    INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR,
  [Code.INVALID_BASE_FEE]: INVALID_BASE_FEE_ERROR,
  [Code.INVALID_INCLUSION_FEE]: INVALID_INCLUSION_FEE_ERROR,
  [Code.INVALID_MAX_FEE]: INVALID_MAX_FEE_ERROR,
  [Code.BASE_FEE_TOO_LOW]: BASE_FEE_TOO_LOW_ERROR,
  [Code.INCLUSION_FEE_TOO_LOW]: INCLUSION_FEE_TOO_LOW_ERROR,
  [Code.MAX_FEE_TOO_LOW]: MAX_FEE_TOO_LOW_ERROR,
  [Code.TRANSACTION_FEE_TOO_HIGH]: TRANSACTION_FEE_TOO_HIGH_ERROR,
  [Code.TRANSACTION_FEE_BELOW_RESOURCE_FEE]:
    TRANSACTION_FEE_BELOW_RESOURCE_FEE_ERROR,
  [Code.INVALID_RESOURCE_FEE]: INVALID_RESOURCE_FEE_ERROR,
  [Code.RESOURCE_FEE_BELOW_SIMULATED_MINIMUM]:
    RESOURCE_FEE_BELOW_SIMULATED_MINIMUM_ERROR,
};
