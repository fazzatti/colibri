import type { SignEnvelopeInput } from "@/processes/sign-envelope/types.ts";
import { ProcessError } from "@/processes/error.ts";
import type { TransactionSigner } from "@/signer/types.ts";

export enum Code {
  UNEXPECTED_ERROR = "SEN_000",
  NO_REQUIREMENTS = "SEN_001",
  NO_SIGNERS = "SEN_002",
  SIGNER_NOT_FOUND = "SEN_003",
  FAILED_TO_SIGN_TRANSACTION = "SEN_004",
}

export abstract class SignEnvelopeError extends ProcessError<
  Code,
  SignEnvelopeInput
> {
  override readonly source = "@colibri/core/processes/sign-envelope";
}

export class UNEXPECTED_ERROR extends SignEnvelopeError {
  constructor(input: SignEnvelopeInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred!",
      input,
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

export class NO_REQUIREMENTS extends SignEnvelopeError {
  constructor(input: SignEnvelopeInput) {
    super({
      code: Code.NO_REQUIREMENTS,
      message: "No signature requirements provided!",
      input,
      details:
        "The transaction must have at least one signature requirement to be signed.",
    });
  }
}

export class NO_SIGNERS extends SignEnvelopeError {
  constructor(input: SignEnvelopeInput) {
    super({
      code: Code.NO_SIGNERS,
      message: "No signers provided!",
      input,
      details: "At least one signer must be provided to sign the transaction.",
    });
  }
}

export class SIGNER_NOT_FOUND extends SignEnvelopeError {
  constructor(
    input: SignEnvelopeInput,
    publicKey: string,
    availableSigners: TransactionSigner[]
  ) {
    const availableSignersList = availableSigners
      .map((s) => s.publicKey)
      .join(", ");

    super({
      code: Code.SIGNER_NOT_FOUND,
      message: "Signer not found!",
      input,
      details: `No signer matching the required public key (${publicKey}) was found among the provided signers. Available signers: [${availableSignersList}]`,
    });
  }
}

export class FAILED_TO_SIGN_TRANSACTION extends SignEnvelopeError {
  constructor(input: SignEnvelopeInput, publicKey: string, cause: Error) {
    super({
      code: Code.FAILED_TO_SIGN_TRANSACTION,
      message: "Failed to sign the transaction!",
      input,
      details: `An error occurred while attempting to sign the transaction with the signer having public key: ${publicKey}. See 'cause' for more details.`,
      cause,
    });
  }
}
// export class INVALID_TRANSACTION_TYPE extends EnvelopeSigningRequirementsError {
//   constructor(input: EnvelopeSigningRequirementsInput) {
//     super({
//       code: Code.INVALID_TRANSACTION_TYPE,
//       message: "Invalid transaction type!",
//       input,
//       details:
//         "The provided transaction type is not supported. Only Transaction or FeeBumpTransaction objects can be processed.",
//     });
//   }
// }

export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.NO_REQUIREMENTS]: NO_REQUIREMENTS,
  [Code.NO_SIGNERS]: NO_SIGNERS,
  [Code.SIGNER_NOT_FOUND]: SIGNER_NOT_FOUND,
  [Code.FAILED_TO_SIGN_TRANSACTION]: FAILED_TO_SIGN_TRANSACTION,
};
