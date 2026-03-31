import type { SignEnvelopeInput } from "@/processes/sign-envelope/types.ts";
import { ProcessError } from "@/processes/error.ts";
import type { Signer } from "@/signer/types.ts";

/**
 * Stable error codes emitted by the sign-envelope process.
 */
export enum Code {
  UNEXPECTED_ERROR = "SEN_000",
  NO_REQUIREMENTS = "SEN_001",
  NO_SIGNERS = "SEN_002",
  SIGNER_NOT_FOUND = "SEN_003",
  FAILED_TO_SIGN_TRANSACTION = "SEN_004",
}

/**
 * Base class for sign-envelope process errors.
 */
export abstract class SignEnvelopeError extends ProcessError<
  Code,
  SignEnvelopeInput
> {
  /** Source identifier for sign-envelope process failures. */
  override readonly source = "@colibri/core/processes/sign-envelope";
}

/**
 * Raised when sign-envelope fails unexpectedly.
 */
export class UNEXPECTED_ERROR extends SignEnvelopeError {
  /**
   * Creates an unexpected sign-envelope error.
   *
   * @param input - Original process input.
   * @param cause - Underlying unexpected error.
   */
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

/**
 * Raised when signature requirements are missing.
 */
export class NO_REQUIREMENTS extends SignEnvelopeError {
  /**
   * Creates a missing-requirements error.
   *
   * @param input - Original process input.
   */
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

/**
 * Raised when no signers are available for signing.
 */
export class NO_SIGNERS extends SignEnvelopeError {
  /**
   * Creates a missing-signers error.
   *
   * @param input - Original process input.
   */
  constructor(input: SignEnvelopeInput) {
    super({
      code: Code.NO_SIGNERS,
      message: "No signers provided!",
      input,
      details: "At least one signer must be provided to sign the transaction.",
    });
  }
}

/**
 * Raised when the required signer cannot be found among the provided signers.
 */
export class SIGNER_NOT_FOUND extends SignEnvelopeError {
  /**
   * Creates a signer-not-found error.
   *
   * @param input - Original process input.
   * @param publicKey - Required public key.
   * @param availableSigners - Signers available to the process.
   */
  constructor(
    input: SignEnvelopeInput,
    publicKey: string,
    availableSigners: Signer[]
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

/**
 * Raised when a signer fails to sign the transaction envelope.
 */
export class FAILED_TO_SIGN_TRANSACTION extends SignEnvelopeError {
  /**
   * Creates a transaction-signing error.
   *
   * @param input - Original process input.
   * @param publicKey - Signer public key that failed.
   * @param cause - Underlying signing error.
   */
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

/**
 * Sign-envelope error constructors indexed by stable code.
 */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.NO_REQUIREMENTS]: NO_REQUIREMENTS,
  [Code.NO_SIGNERS]: NO_SIGNERS,
  [Code.SIGNER_NOT_FOUND]: SIGNER_NOT_FOUND,
  [Code.FAILED_TO_SIGN_TRANSACTION]: FAILED_TO_SIGN_TRANSACTION,
};
