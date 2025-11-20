import type { AssembleTransactionInput } from "@/processes/assemble-transaction/types.ts";
import { ProcessError } from "@/processes/error.ts";
import { getOperationTypesFromTransaction } from "@/common/helpers/transaction.ts";

export enum Code {
  UNEXPECTED_ERROR = "ASM_000",

  MISSING_ARG = "ASM_001",
  NOT_SMART_CONTRACT_TRANSACTION = "ASM_002",
  UNSUPPORTED_OPERATION = "ASM_003",
  FAILED_TO_ASSEMBLE_TRANSACTION = "ASM_004",
  FAILED_TO_BUILD_TRANSACTION = "ASM_005",
  FAILED_TO_BUILD_SOROBAN_DATA = "ASM_006",
}

export abstract class AssembleTransactionError extends ProcessError<
  Code,
  AssembleTransactionInput
> {
  override readonly source = "@colibri/core/processes/assemble-transaction";
}

export class UNEXPECTED_ERROR extends AssembleTransactionError {
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

export class MISSING_ARG extends AssembleTransactionError {
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

export class NOT_SMART_CONTRACT_TRANSACTION_ERROR extends AssembleTransactionError {
  override readonly meta: {
    data: {
      input: AssembleTransactionInput;
      operations: string[];
    };
    cause: null;
  };

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

export class UNSUPPORTED_OPERATION_ERROR extends AssembleTransactionError {
  constructor(input: AssembleTransactionInput, opType: string) {
    super({
      code: Code.UNSUPPORTED_OPERATION,
      message: "Unsupported operation!",
      input,
      details: `Could not assemble the transaction with the unsupported operation of type '${opType}'. Operation must be of type 'invokeHostFunction'.`,
    });
  }
}

export class FAILED_TO_ASSEMBLE_TRANSACTION_ERROR extends AssembleTransactionError {
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

export class FAILED_TO_BUILD_TRANSACTION_ERROR extends AssembleTransactionError {
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

export class FAILED_TO_BUILD_SOROBAN_DATA_ERROR extends AssembleTransactionError {
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

export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.NOT_SMART_CONTRACT_TRANSACTION]: NOT_SMART_CONTRACT_TRANSACTION_ERROR,
  [Code.UNSUPPORTED_OPERATION]: UNSUPPORTED_OPERATION_ERROR,
  [Code.FAILED_TO_ASSEMBLE_TRANSACTION]: FAILED_TO_ASSEMBLE_TRANSACTION_ERROR,
  [Code.FAILED_TO_BUILD_TRANSACTION]: FAILED_TO_BUILD_TRANSACTION_ERROR,
  [Code.FAILED_TO_BUILD_SOROBAN_DATA]: FAILED_TO_BUILD_SOROBAN_DATA_ERROR,
};
