import type { SignEnvelopeInput } from "@/processes/sign-envelope/types.ts";
import { ProcessError } from "@/processes/error.ts";
import type { Signer } from "@/signer/types.ts";
import type { PreAuthTx, SignerKey } from "@/strkeys/types.ts";

/**
 * Stable error codes emitted by the sign-envelope process.
 */
export enum Code {
  UNEXPECTED_ERROR = "SEN_000",
  NO_REQUIREMENTS = "SEN_001",
  NO_SIGNERS = "SEN_002",
  SIGNER_NOT_FOUND = "SEN_003",
  FAILED_TO_SIGN_TRANSACTION = "SEN_004",
  FAILED_TO_GET_SIGNER_KEY = "SEN_005",
  DUPLICATE_SIGNER_KEY = "SEN_006",
  EXTRA_SIGNER_NOT_FOUND = "SEN_007",
  UNSUPPORTED_PRE_AUTH_EXTRA_SIGNER = "SEN_008",
  AMBIGUOUS_ACCOUNT_SIGNERS = "SEN_009",
  FAILED_TO_CHECK_SIGNER_TARGET = "SEN_010",
  FAILED_TO_CHECK_PRE_AUTH_TRANSACTION = "SEN_011",
  PRE_AUTH_TRANSACTION_MISMATCH = "SEN_012",
  FAILED_TO_READ_EXTRA_SIGNERS = "SEN_013",
  FAILED_TO_PARSE_SIGNED_TRANSACTION = "SEN_014",
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
    availableSigners: Signer[],
  ) {
    const availableSignerLabels: string[] = [];
    for (const signer of availableSigners) {
      if ("publicKey" in signer && typeof signer.publicKey === "function") {
        availableSignerLabels.push(signer.publicKey());
      } else {
        availableSignerLabels.push(signer.constructor.name);
      }
    }
    const availableSignersList = availableSignerLabels.join(", ");

    super({
      code: Code.SIGNER_NOT_FOUND,
      message: "Signer not found!",
      input,
      details:
        `No signer matching the required public key (${publicKey}) was found among the provided signers. Available signers: [${availableSignersList}]`,
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
   * @param signerKey - Exact signer key that failed.
   * @param cause - Underlying signing error.
   */
  constructor(input: SignEnvelopeInput, signerKey: string, cause: Error) {
    super({
      code: Code.FAILED_TO_SIGN_TRANSACTION,
      message: "Failed to sign the transaction!",
      input,
      details:
        `An error occurred while attempting to sign the transaction with signer '${signerKey}'. See 'cause' for more details.`,
      cause,
    });
  }
}

/** Raised when an envelope authorizer cannot expose its exact signer key. */
export class FAILED_TO_GET_SIGNER_KEY extends SignEnvelopeError {
  /**
   * Creates a signer-key lookup error.
   *
   * @param input - Original process input.
   * @param signerIndex - Index of the signer that failed.
   * @param cause - Underlying signer failure.
   */
  constructor(input: SignEnvelopeInput, signerIndex: number, cause: Error) {
    super({
      code: Code.FAILED_TO_GET_SIGNER_KEY,
      message: "Failed to get an envelope signer key!",
      input,
      details:
        `The envelope signer at index ${signerIndex} could not expose its exact Stellar signer key.`,
      cause,
    });
  }
}

/** Raised when more than one supplied signer represents the same signer key. */
export class DUPLICATE_SIGNER_KEY extends SignEnvelopeError {
  /**
   * Creates a duplicate signer-key error.
   *
   * @param input - Original process input.
   * @param signerKey - Signer key represented more than once.
   */
  constructor(input: SignEnvelopeInput, signerKey: SignerKey) {
    super({
      code: Code.DUPLICATE_SIGNER_KEY,
      message: "Duplicate envelope signer key!",
      input,
      details:
        `More than one supplied signer represents '${signerKey}', so Colibri cannot select an instance deterministically.`,
    });
  }
}

/** Raised when a transaction extra-signer requirement has no exact signer. */
export class EXTRA_SIGNER_NOT_FOUND extends SignEnvelopeError {
  /**
   * Creates a missing extra-signer error.
   *
   * @param input - Original process input.
   * @param signerKey - Exact signer key required by the transaction.
   */
  constructor(input: SignEnvelopeInput, signerKey: SignerKey) {
    super({
      code: Code.EXTRA_SIGNER_NOT_FOUND,
      message: "Extra signer not found!",
      input,
      details:
        `No supplied envelope signer represents the transaction's required extra signer '${signerKey}'.`,
    });
  }
}

/** Raised when a pre-authorized transaction key appears in `extraSigners`. */
export class UNSUPPORTED_PRE_AUTH_EXTRA_SIGNER extends SignEnvelopeError {
  /**
   * Creates an invalid pre-authorized extra-signer error.
   *
   * @param input - Original process input.
   * @param signerKey - Invalid pre-authorized extra-signer key.
   */
  constructor(input: SignEnvelopeInput, signerKey: PreAuthTx) {
    super({
      code: Code.UNSUPPORTED_PRE_AUTH_EXTRA_SIGNER,
      message: "Pre-authorized transactions cannot be extra signers!",
      input,
      details:
        `The transaction contains '${signerKey}' as an extra signer, but its hash would recursively depend on that precondition.`,
    });
  }
}

/** Raised when multiple distinct signer keys target one required account. */
export class AMBIGUOUS_ACCOUNT_SIGNERS extends SignEnvelopeError {
  /**
   * Creates an ambiguous account-signer error.
   *
   * @param input - Original process input.
   * @param account - Account requiring authorization.
   * @param signerKeys - Distinct matching signer keys.
   */
  constructor(
    input: SignEnvelopeInput,
    account: string,
    signerKeys: SignerKey[],
  ) {
    super({
      code: Code.AMBIGUOUS_ACCOUNT_SIGNERS,
      message: "Account signer selection is ambiguous!",
      input,
      details:
        `The account '${account}' is targeted by multiple signer keys: [${
          signerKeys.join(", ")
        }]. Colibri does not select by array order.`,
    });
  }
}

/** Raised when a signer cannot report whether it targets an account. */
export class FAILED_TO_CHECK_SIGNER_TARGET extends SignEnvelopeError {
  /**
   * Creates a signer-target lookup error.
   *
   * @param input - Original process input.
   * @param account - Account whose authorization is being resolved.
   * @param signerKey - Signer key whose target check failed.
   * @param cause - Underlying signer failure.
   */
  constructor(
    input: SignEnvelopeInput,
    account: string,
    signerKey: SignerKey,
    cause: Error,
  ) {
    super({
      code: Code.FAILED_TO_CHECK_SIGNER_TARGET,
      message: "Failed to check an envelope signer target!",
      input,
      details:
        `Signer '${signerKey}' could not report whether it authorizes account '${account}'.`,
      cause,
    });
  }
}

/** Raised when a pre-authorized signer cannot verify the current transaction. */
export class FAILED_TO_CHECK_PRE_AUTH_TRANSACTION extends SignEnvelopeError {
  /**
   * Creates a pre-authorized transaction verification error.
   *
   * @param input - Original process input.
   * @param signerKey - Pre-authorized transaction signer key.
   * @param cause - Underlying signer failure.
   */
  constructor(
    input: SignEnvelopeInput,
    signerKey: PreAuthTx,
    cause: Error,
  ) {
    super({
      code: Code.FAILED_TO_CHECK_PRE_AUTH_TRANSACTION,
      message: "Failed to check the pre-authorized transaction!",
      input,
      details:
        `Signer '${signerKey}' could not verify the current transaction hash.`,
      cause,
    });
  }
}

/** Raised when a selected pre-authorized signer targets another transaction. */
export class PRE_AUTH_TRANSACTION_MISMATCH extends SignEnvelopeError {
  /**
   * Creates a pre-authorized transaction mismatch error.
   *
   * @param input - Original process input.
   * @param signerKey - Pre-authorized transaction signer key.
   */
  constructor(input: SignEnvelopeInput, signerKey: PreAuthTx) {
    super({
      code: Code.PRE_AUTH_TRANSACTION_MISMATCH,
      message: "Pre-authorized transaction does not match!",
      input,
      details:
        `Signer '${signerKey}' does not authorize the transaction currently being processed.`,
    });
  }
}

/** Raised when transaction extra-signer keys cannot be decoded. */
export class FAILED_TO_READ_EXTRA_SIGNERS extends SignEnvelopeError {
  /**
   * Creates an extra-signer decoding error.
   *
   * @param input - Original process input.
   * @param cause - Underlying SDK failure.
   */
  constructor(input: SignEnvelopeInput, cause: Error) {
    super({
      code: Code.FAILED_TO_READ_EXTRA_SIGNERS,
      message: "Failed to read transaction extra signers!",
      input,
      details:
        "The exact signer keys in the transaction preconditions could not be decoded.",
      cause,
    });
  }
}

/** Raised when signed envelope XDR cannot be parsed for the next signer. */
export class FAILED_TO_PARSE_SIGNED_TRANSACTION extends SignEnvelopeError {
  /**
   * Creates a signed-transaction parsing error.
   *
   * @param input - Original process input.
   * @param signerKey - Signer key that produced the invalid XDR.
   * @param cause - Underlying SDK failure.
   */
  constructor(
    input: SignEnvelopeInput,
    signerKey: SignerKey,
    cause: Error,
  ) {
    super({
      code: Code.FAILED_TO_PARSE_SIGNED_TRANSACTION,
      message: "Failed to parse the signed transaction!",
      input,
      details:
        `The XDR returned after signer '${signerKey}' authorized the envelope could not be parsed.`,
      cause,
    });
  }
}

/**
 * Sign-envelope error constructors indexed by stable code.
 */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.NO_REQUIREMENTS]: NO_REQUIREMENTS,
  [Code.NO_SIGNERS]: NO_SIGNERS,
  [Code.SIGNER_NOT_FOUND]: SIGNER_NOT_FOUND,
  [Code.FAILED_TO_SIGN_TRANSACTION]: FAILED_TO_SIGN_TRANSACTION,
  [Code.FAILED_TO_GET_SIGNER_KEY]: FAILED_TO_GET_SIGNER_KEY,
  [Code.DUPLICATE_SIGNER_KEY]: DUPLICATE_SIGNER_KEY,
  [Code.EXTRA_SIGNER_NOT_FOUND]: EXTRA_SIGNER_NOT_FOUND,
  [Code.UNSUPPORTED_PRE_AUTH_EXTRA_SIGNER]: UNSUPPORTED_PRE_AUTH_EXTRA_SIGNER,
  [Code.AMBIGUOUS_ACCOUNT_SIGNERS]: AMBIGUOUS_ACCOUNT_SIGNERS,
  [Code.FAILED_TO_CHECK_SIGNER_TARGET]: FAILED_TO_CHECK_SIGNER_TARGET,
  [Code.FAILED_TO_CHECK_PRE_AUTH_TRANSACTION]:
    FAILED_TO_CHECK_PRE_AUTH_TRANSACTION,
  [Code.PRE_AUTH_TRANSACTION_MISMATCH]: PRE_AUTH_TRANSACTION_MISMATCH,
  [Code.FAILED_TO_READ_EXTRA_SIGNERS]: FAILED_TO_READ_EXTRA_SIGNERS,
  [Code.FAILED_TO_PARSE_SIGNED_TRANSACTION]:
    FAILED_TO_PARSE_SIGNED_TRANSACTION,
};
