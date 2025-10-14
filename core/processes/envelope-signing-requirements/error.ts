import type { EnvelopeSigningRequirementsInput } from "./types.ts";
import { ProcessError } from "../error.ts";

export enum Code {
  UNEXPECTED_ERROR = "ESR_000",

  INVALID_TRANSACTION_TYPE = "ESR_001",

  FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX = "ESR_002",
  FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION = "ESR_003",
}

export abstract class EnvelopeSigningRequirementsError extends ProcessError<
  Code,
  EnvelopeSigningRequirementsInput
> {
  override readonly source =
    "@colibri/core/processes/envelope-signing-requirements";
}

export class UNEXPECTED_ERROR extends EnvelopeSigningRequirementsError {
  constructor(input: EnvelopeSigningRequirementsInput, cause?: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred!",
      input,
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

export class INVALID_TRANSACTION_TYPE extends EnvelopeSigningRequirementsError {
  constructor(input: EnvelopeSigningRequirementsInput) {
    super({
      code: Code.INVALID_TRANSACTION_TYPE,
      message: "Invalid transaction type!",
      input,
      details:
        "The provided transaction type is not supported. Only Transaction or FeeBumpTransaction objects can be processed.",
    });
  }
}

export class FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX extends EnvelopeSigningRequirementsError {
  constructor(input: EnvelopeSigningRequirementsInput, e: Error) {
    super({
      code: Code.FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX,
      message:
        "Failed to process signing requirements for fee bump transaction!",
      input,
      details:
        "The fee bump transaction could not be processed successfully. Verify the underlying error under the 'cause' property.",
      cause: e,
    });
  }
}

export class FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION extends EnvelopeSigningRequirementsError {
  constructor(input: EnvelopeSigningRequirementsInput, e: Error) {
    super({
      code: Code.FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION,
      message: "Failed to process signing requirements for transaction!",
      input,
      details:
        "The transaction could not be processed successfully. Verify the underlying error under the 'cause' property.",
      cause: e,
    });
  }
}

export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.INVALID_TRANSACTION_TYPE]: INVALID_TRANSACTION_TYPE,
  [Code.FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX]:
    FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX,
  [Code.FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION]:
    FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION,
};
