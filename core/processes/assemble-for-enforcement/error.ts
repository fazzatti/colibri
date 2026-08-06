import type { AssembleForEnforcementInput } from "@/processes/assemble-for-enforcement/types.ts";
import { ProcessError } from "@/processes/error.ts";

/** Stable errors emitted by the assemble-for-enforcement process. */
export enum Code {
  UNEXPECTED_ERROR = "AFE_000",
  MISSING_TRANSACTION = "AFE_001",
  MISSING_AUTHORIZED_OPERATION = "AFE_002",
}

/** Base class for assembly-for-enforcement failures. */
export abstract class AssembleForEnforcementError extends ProcessError<
  Code,
  AssembleForEnforcementInput
> {
  /** Source identifier for assembly-for-enforcement failures. */
  override readonly source = "@colibri/core/processes/assemble-for-enforcement";
}

/** Raised when assembly for enforcement fails unexpectedly. */
export class UNEXPECTED_ERROR extends AssembleForEnforcementError {
  /**
   * Creates an unexpected assembly-for-enforcement error.
   *
   * @param input - Original process input.
   * @param cause - Underlying unexpected error.
   */
  constructor(input: AssembleForEnforcementInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "Unexpected assembly-for-enforcement failure!",
      input,
      details: "See the underlying cause for additional details.",
      cause,
    });
  }
}

/** Raised when the transaction is missing from enforcement assembly input. */
export class MISSING_TRANSACTION extends AssembleForEnforcementError {
  /**
   * Creates a missing-transaction error.
   *
   * @param input - Original process input.
   */
  constructor(input: AssembleForEnforcementInput) {
    super({
      code: Code.MISSING_TRANSACTION,
      message: "Missing required argument: transaction",
      input,
      details: "The transaction is required for assembly before enforcement.",
    });
  }
}

/** Raised when the authorized operation is missing from assembly input. */
export class MISSING_AUTHORIZED_OPERATION extends AssembleForEnforcementError {
  /**
   * Creates a missing-authorized-operation error.
   *
   * @param input - Original process input.
   */
  constructor(input: AssembleForEnforcementInput) {
    super({
      code: Code.MISSING_AUTHORIZED_OPERATION,
      message: "Missing required argument: authorizedOperation",
      input,
      details:
        "The authorized operation is required for assembly before enforcement.",
    });
  }
}

/** Assembly-for-enforcement error constructors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_TRANSACTION]: MISSING_TRANSACTION,
  [Code.MISSING_AUTHORIZED_OPERATION]: MISSING_AUTHORIZED_OPERATION,
};
