import { ProcessError } from "@/processes/error.ts";
import type { ParseClassicTransactionOutcomeInput } from "@/processes/parse-classic-transaction-outcome/types.ts";

/** Stable error codes emitted by classic transaction outcome parsing. */
export enum Code {
  UNEXPECTED_ERROR = "PCTO_000",
  UNEXPECTED_TRANSACTION_RESULT = "PCTO_001",
  UNEXPECTED_INNER_TRANSACTION_RESULT = "PCTO_002",
  UNEXPECTED_OPERATION_RESULT = "PCTO_003",
  UNSUPPORTED_OPERATION_OUTCOME = "PCTO_004",
  UNSUCCESSFUL_OPERATION_OUTCOME = "PCTO_005",
}

/** Base error for the classic transaction outcome parser. */
export abstract class ParseClassicTransactionOutcomeError extends ProcessError<
  Code,
  ParseClassicTransactionOutcomeInput
> {
  /** Source identifier for classic-outcome parsing failures. */
  override readonly source =
    "@colibri/core/processes/parse-classic-transaction-outcome";
}

/** Raised when classic outcome parsing fails unexpectedly. */
export class UNEXPECTED_ERROR extends ParseClassicTransactionOutcomeError {
  /** Creates an unexpected classic-outcome parsing error. */
  constructor(input: ParseClassicTransactionOutcomeInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred while parsing classic outcomes!",
      input,
      details: cause.message,
      cause,
    });
  }
}

/** Raised when a successful RPC response has no successful result arm. */
export class UNEXPECTED_TRANSACTION_RESULT_ERROR
  extends ParseClassicTransactionOutcomeError {
  /** Creates an unexpected transaction-result error. */
  constructor(input: ParseClassicTransactionOutcomeInput, resultType: string) {
    super({
      code: Code.UNEXPECTED_TRANSACTION_RESULT,
      message: "Unexpected transaction result while parsing outcomes!",
      input,
      details:
        `Expected 'txSuccess' or 'txFeeBumpInnerSuccess', received '${resultType}'.`,
    });
  }
}

/** Raised when a successful fee bump contains no successful inner result. */
export class UNEXPECTED_INNER_TRANSACTION_RESULT_ERROR
  extends ParseClassicTransactionOutcomeError {
  /** Creates an unexpected inner-transaction-result error. */
  constructor(input: ParseClassicTransactionOutcomeInput, resultType: string) {
    super({
      code: Code.UNEXPECTED_INNER_TRANSACTION_RESULT,
      message: "Unexpected fee-bump inner transaction result!",
      input,
      details: `Expected 'txSuccess', received '${resultType}'.`,
    });
  }
}

/** Raised when an operation does not contain its protocol result payload. */
export class UNEXPECTED_OPERATION_RESULT_ERROR
  extends ParseClassicTransactionOutcomeError {
  /** Creates an unexpected operation-result error. */
  constructor(
    input: ParseClassicTransactionOutcomeInput,
    index: number,
    resultType: string,
  ) {
    super({
      code: Code.UNEXPECTED_OPERATION_RESULT,
      message: "Unexpected operation result while parsing outcomes!",
      input,
      details:
        `Operation ${index} expected 'opInner', received '${resultType}'.`,
    });
  }
}

/** Raised when the SDK exposes an operation type unknown to this parser. */
export class UNSUPPORTED_OPERATION_OUTCOME_ERROR
  extends ParseClassicTransactionOutcomeError {
  /** Creates an unsupported operation-outcome error. */
  constructor(
    input: ParseClassicTransactionOutcomeInput,
    index: number,
    operationType: string,
  ) {
    super({
      code: Code.UNSUPPORTED_OPERATION_OUTCOME,
      message: "Unsupported classic operation outcome!",
      input,
      details:
        `Operation ${index} has unsupported result type '${operationType}'.`,
    });
  }
}

/** Raised when an operation result is not its successful protocol arm. */
export class UNSUCCESSFUL_OPERATION_OUTCOME_ERROR
  extends ParseClassicTransactionOutcomeError {
  /** Creates an unsuccessful operation-outcome error. */
  constructor(
    input: ParseClassicTransactionOutcomeInput,
    index: number,
    operationType: string,
    resultType: string,
    expectedType: string,
  ) {
    super({
      code: Code.UNSUCCESSFUL_OPERATION_OUTCOME,
      message: "Operation outcome is not successful!",
      input,
      details:
        `Operation ${index} ('${operationType}') expected '${expectedType}', received '${resultType}'.`,
    });
  }
}

/** Classic-outcome error constructors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.UNEXPECTED_TRANSACTION_RESULT]: UNEXPECTED_TRANSACTION_RESULT_ERROR,
  [Code.UNEXPECTED_INNER_TRANSACTION_RESULT]:
    UNEXPECTED_INNER_TRANSACTION_RESULT_ERROR,
  [Code.UNEXPECTED_OPERATION_RESULT]: UNEXPECTED_OPERATION_RESULT_ERROR,
  [Code.UNSUPPORTED_OPERATION_OUTCOME]: UNSUPPORTED_OPERATION_OUTCOME_ERROR,
  [Code.UNSUCCESSFUL_OPERATION_OUTCOME]: UNSUCCESSFUL_OPERATION_OUTCOME_ERROR,
};
