import type { AssembleTransactionInput } from "./types.ts";
import { ProcessError } from "../error.ts";

export enum Code {
  UNEXPECTED_ERROR = "ASM_000",
  FAILED_TO_ASSEMBLE_TRANSACTION = "ASM_001",
  FAILED_TO_BUILD_TRANSACTION = "ASM_002",
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

export const ERROR_ASM = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.FAILED_TO_ASSEMBLE_TRANSACTION]: FAILED_TO_ASSEMBLE_TRANSACTION_ERROR,
  [Code.FAILED_TO_BUILD_TRANSACTION]: FAILED_TO_BUILD_TRANSACTION_ERROR,
};
