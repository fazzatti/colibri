import { TransformerError } from "../../error.ts";
import type { Operation } from "stellar-sdk";

export enum Code {
  UNEXPECTED_ERROR = "TRN_GRST_000",

  FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE = "TRN_GRST_001",
}

export type MetaData = {
  operation: Operation;
};

export abstract class GetRequiredSignatureThresholdForClassicOperationError extends TransformerError<
  Code,
  MetaData
> {
  override readonly source =
    "@colibri/core/transformers/auth/get-required-signature-threshold-for-a-classic-op";
}

export class UNEXPECTED_ERROR extends GetRequiredSignatureThresholdForClassicOperationError {
  constructor(operation: Operation, e?: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "Unexpected error occurred!",
      data: {
        operation,
      },
      details: `An unexpected error occurred while processing the operation: ${operation.type}.`,
      cause: e,
    });
  }
}

export class FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE extends GetRequiredSignatureThresholdForClassicOperationError {
  constructor(operation: Operation, source?: string, e?: Error) {
    super({
      code: Code.FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE,
      message: "Error identifying the source account!",
      data: {
        operation,
      },
      details: `When processing the signer requirement for an operation, it was not possible to identify the source account '${source}'. This is verified to identify the underlying G-Address or set as 'source-account' when none is defined.`,
      cause: e,
    });
  }
}

export const ERROR_TRN_GRST = {
  [Code.FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE]:
    FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE,
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
};
