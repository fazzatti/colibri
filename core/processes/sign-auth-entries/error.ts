import type { xdr } from "stellar-sdk";
import type { SignAuthEntriesInput } from "@/processes/sign-auth-entries/types.ts";
import { ProcessError } from "@/processes/error.ts";

/**
 * Stable error codes emitted by the sign-auth-entries process.
 */
export enum Code {
  UNEXPECTED_ERROR = "SAE_000",
  MISSING_ARG = "SAE_001",
  VALID_UNTIL_LEDGER_SEQ_TOO_LOW = "SAE_002",
  VALID_FOR_LEDGERS_TOO_LOW = "SAE_003",
  VALID_FOR_SECONDS_TOO_LOW = "SAE_004",
  FAILED_TO_FETCH_LATEST_LEDGER = "SAE_005",
  MISSING_SIGNER = "SAE_006",
  FAILED_TO_SIGN_AUTH_ENTRY = "SAE_007",
}

/**
 * Base class for sign-auth-entries process errors.
 */
export abstract class SignAuthEntriesError extends ProcessError<
  Code,
  SignAuthEntriesInput
> {
  /** Source identifier for sign-auth-entries process failures. */
  override readonly source = "@colibri/core/processes/sign-auth-entries";
}

/**
 * Raised when sign-auth-entries fails unexpectedly.
 */
export class UNEXPECTED_ERROR extends SignAuthEntriesError {
  /**
   * Creates an unexpected sign-auth-entries error.
   *
   * @param input - Original process input.
   * @param cause - Underlying unexpected error.
   */
  constructor(input: SignAuthEntriesInput, cause?: Error) {
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
 * Raised when a required sign-auth-entries input field is missing.
 */
export class MISSING_ARG extends SignAuthEntriesError {
  /**
   * Creates a missing-argument error.
   *
   * @param input - Original process input.
   * @param argName - Missing argument name.
   */
  constructor(input: SignAuthEntriesInput, argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}!`,
      input,
      details: `The argument '${argName}' is required but was not provided in the input.`,
    });
  }
}

/**
 * Raised when `validUntilLedgerSeq` is below the supported minimum.
 */
export class VALID_UNTIL_LEDGER_SEQ_TOO_LOW extends SignAuthEntriesError {
  /**
   * Creates an invalid-ledger-sequence error.
   *
   * @param input - Original process input.
   * @param validUntilLedgerSeq - Invalid ledger sequence value.
   */
  constructor(input: SignAuthEntriesInput, validUntilLedgerSeq: number) {
    super({
      code: Code.VALID_UNTIL_LEDGER_SEQ_TOO_LOW,
      message: "Invalid validUntilLedgerSeq! Too Low!",
      input,
      details: `The validUntilLedgerSeq '${validUntilLedgerSeq}' is invalid. It must be a valid ledger sequence higher than 0.`,
    });
  }
}

/**
 * Raised when `validForLedgers` is below the supported minimum.
 */
export class VALID_FOR_LEDGERS_TOO_LOW extends SignAuthEntriesError {
  /**
   * Creates an invalid-ledger-window error.
   *
   * @param input - Original process input.
   * @param validForLedgers - Invalid ledger count.
   */
  constructor(input: SignAuthEntriesInput, validForLedgers: number) {
    super({
      code: Code.VALID_FOR_LEDGERS_TOO_LOW,
      message: "Invalid validForLedgers! Too Low!",
      input,
      details: `The validForLedgers '${validForLedgers}' is invalid. It must be a valid ledger sequence higher than 0.`,
    });
  }
}

/**
 * Raised when `validForSeconds` is below the supported minimum.
 */
export class VALID_FOR_SECONDS_TOO_LOW extends SignAuthEntriesError {
  /**
   * Creates an invalid-seconds-window error.
   *
   * @param input - Original process input.
   * @param validForSeconds - Invalid validity duration in seconds.
   */
  constructor(input: SignAuthEntriesInput, validForSeconds: number) {
    super({
      code: Code.VALID_FOR_SECONDS_TOO_LOW,
      message: "Invalid validForSeconds! Too Low!",
      input,
      details: `The validForSeconds '${validForSeconds}' is invalid. It must be a valid number of seconds higher than 5 so it is valid for at least 1 ledger.`,
    });
  }
}

/**
 * Raised when the latest ledger cannot be fetched from RPC.
 */
export class FAILED_TO_FETCH_LATEST_LEDGER extends SignAuthEntriesError {
  /**
   * Creates a latest-ledger lookup error.
   *
   * @param input - Original process input.
   * @param cause - RPC failure returned while loading the latest ledger.
   */
  constructor(input: SignAuthEntriesInput, cause: Error) {
    super({
      code: Code.FAILED_TO_FETCH_LATEST_LEDGER,
      message: "Failed to fetch latest ledger from the network!",
      input,
      details:
        "The RPC call to load the latest ledger failed. See the 'cause' for more details. This is required to calculate the validity of the signature for the auth entries authorization.",
      cause,
    });
  }
}

/**
 * Raised when the required signer for an auth entry cannot be found.
 */
export class MISSING_SIGNER extends SignAuthEntriesError {
  /** Structured metadata describing the missing signer failure. */
  override readonly meta: {
    data: {
      input: SignAuthEntriesInput;
      authEntryXDR: string;
    };
    cause: null;
  };

  /**
   * Creates a missing-signer error.
   *
   * @param input - Original process input.
   * @param requiredSigner - Required signer public key.
   * @param authEntry - Authorization entry that could not be satisfied.
   */
  constructor(
    input: SignAuthEntriesInput,
    requiredSigner: string,
    authEntry: xdr.SorobanAuthorizationEntry
  ) {
    super({
      code: Code.MISSING_SIGNER,
      message: "Missing required signer for authorization entry!",
      input,
      details: `The required signer '${requiredSigner}' was not found for the authorization entry.`,
    });
    this.meta = {
      data: {
        input,
        authEntryXDR: authEntry.toXDR("base64"),
      },
      cause: null,
    };
  }
}

/**
 * Raised when signing an authorization entry fails.
 */
export class FAILED_TO_SIGN_AUTH_ENTRY extends SignAuthEntriesError {
  /** Structured metadata describing the failed auth-entry signature. */
  override readonly meta: {
    data: {
      input: SignAuthEntriesInput;
      authEntryXDR: string;
    };
    cause: Error;
  };

  /**
   * Creates an auth-entry signing failure.
   *
   * @param input - Original process input.
   * @param entry - Authorization entry that failed to sign.
   * @param cause - Underlying signing error.
   */
  constructor(
    input: SignAuthEntriesInput,
    entry: xdr.SorobanAuthorizationEntry,
    cause: Error
  ) {
    super({
      code: Code.FAILED_TO_SIGN_AUTH_ENTRY,
      message: "Failed to sign an authorization entry!",
      input,
      details:
        "An error occurred while signing an authorization entry. See the 'cause' for more details.",
      diagnostic: {
        rootCause:
          "While attempting to sign an authorization entry, an unexpected error occurred.",
        suggestion:
          "Check the 'meta' section for the source error under 'cause' and verify the auth entry object under 'authEntryXDR'.",
      },
    });

    this.meta = {
      data: {
        input,
        authEntryXDR: entry.toXDR("base64"),
      },
      cause: cause,
    };
  }
}

/**
 * Sign-auth-entries error constructors indexed by stable code.
 */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.VALID_UNTIL_LEDGER_SEQ_TOO_LOW]: VALID_UNTIL_LEDGER_SEQ_TOO_LOW,
  [Code.VALID_FOR_LEDGERS_TOO_LOW]: VALID_FOR_LEDGERS_TOO_LOW,
  [Code.VALID_FOR_SECONDS_TOO_LOW]: VALID_FOR_SECONDS_TOO_LOW,
  [Code.FAILED_TO_FETCH_LATEST_LEDGER]: FAILED_TO_FETCH_LATEST_LEDGER,
  [Code.MISSING_SIGNER]: MISSING_SIGNER,
  [Code.FAILED_TO_SIGN_AUTH_ENTRY]: FAILED_TO_SIGN_AUTH_ENTRY,
};
