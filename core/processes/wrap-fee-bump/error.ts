import type { WrapFeeBumpInput } from "./types.ts";
import { ProcessError } from "../error.ts";

export enum Code {
  UNEXPECTED_ERROR = "WFB_000",

  MISSING_ARG = "WFB_001",
  ALREADY_FEE_BUMP = "WFB_002",

  NOT_A_TRANSACTION = "WFB_003",
  FAILED_TO_BUILD_FEE_BUMP = "WFB_004",
}

export abstract class WrapFeeBumpError extends ProcessError<
  Code,
  WrapFeeBumpInput
> {
  override readonly source = "@colibri/core/processes/wrap-fee-bump";
}

export class UNEXPECTED_ERROR extends WrapFeeBumpError {
  constructor(input: WrapFeeBumpInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred when wrapping the fee bump!",
      input,
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

export class MISSING_ARG extends WrapFeeBumpError {
  constructor(input: WrapFeeBumpInput, argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      input,
      details: `The required argument '${argName}' is missing or invalid.`,
    });
  }
}

export class ALREADY_FEE_BUMP extends WrapFeeBumpError {
  constructor(input: WrapFeeBumpInput) {
    super({
      code: Code.ALREADY_FEE_BUMP,
      message: "The transaction is already a fee bump!",
      input,
      details:
        "The provided transaction type is already a FeeBumpTransaction. Only Transaction objects can be processed.",
    });
  }
}

export class NOT_A_TRANSACTION extends WrapFeeBumpError {
  constructor(input: WrapFeeBumpInput) {
    super({
      code: Code.NOT_A_TRANSACTION,
      message: "The provided transaction is not a valid Transaction object!",
      input,
      details:
        "The provided transaction type is not supported. Only Transaction objects can be processed.",
    });
  }
}

export class FAILED_TO_BUILD_FEE_BUMP extends WrapFeeBumpError {
  constructor(input: WrapFeeBumpInput, cause: Error) {
    super({
      code: Code.FAILED_TO_BUILD_FEE_BUMP,
      message: "Failed to build the fee bump transaction!",
      input,
      details:
        "A error was encountered while building the fee bump transaction. See the 'cause' for more details",
      cause,
    });
  }
}

export const ERROR_WFB = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.ALREADY_FEE_BUMP]: ALREADY_FEE_BUMP,
  [Code.NOT_A_TRANSACTION]: NOT_A_TRANSACTION,
  [Code.FAILED_TO_BUILD_FEE_BUMP]: FAILED_TO_BUILD_FEE_BUMP,
};
