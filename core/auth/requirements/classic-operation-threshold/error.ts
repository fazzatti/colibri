import type { Operation } from "stellar-sdk";
import { AuthError } from "@/auth/error.ts";

export enum Code {
  UNEXPECTED_ERROR = "AUTH_COT_000",
  FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE = "AUTH_COT_001",
}

export type MetaData = {
  operation: Operation;
};

export abstract class ClassicOperationThresholdError extends AuthError<
  Code,
  MetaData
> {
  override readonly source =
    "@colibri/core/auth/requirements/classic-operation-threshold";
}

export class UNEXPECTED_ERROR extends ClassicOperationThresholdError {
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

export class FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE extends ClassicOperationThresholdError {
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

export const ERROR_AUTH_COT = {
  [Code.FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE]:
    FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE,
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
};
