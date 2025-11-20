import type { xdr } from "stellar-sdk";
import type { SignAuthEntriesInput } from "@/processes/sign-auth-entries/types.ts";
import { ProcessError } from "@/processes/error.ts";

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

export abstract class SignAuthEntriesError extends ProcessError<
  Code,
  SignAuthEntriesInput
> {
  override readonly source = "@colibri/core/processes/sign-auth-entries";
}

export class UNEXPECTED_ERROR extends SignAuthEntriesError {
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

export class MISSING_ARG extends SignAuthEntriesError {
  constructor(input: SignAuthEntriesInput, argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}!`,
      input,
      details: `The argument '${argName}' is required but was not provided in the input.`,
    });
  }
}

export class VALID_UNTIL_LEDGER_SEQ_TOO_LOW extends SignAuthEntriesError {
  constructor(input: SignAuthEntriesInput, validUntilLedgerSeq: number) {
    super({
      code: Code.VALID_UNTIL_LEDGER_SEQ_TOO_LOW,
      message: "Invalid validUntilLedgerSeq! Too Low!",
      input,
      details: `The validUntilLedgerSeq '${validUntilLedgerSeq}' is invalid. It must be a valid ledger sequence higher than 0.`,
    });
  }
}

export class VALID_FOR_LEDGERS_TOO_LOW extends SignAuthEntriesError {
  constructor(input: SignAuthEntriesInput, validForLedgers: number) {
    super({
      code: Code.VALID_FOR_LEDGERS_TOO_LOW,
      message: "Invalid validForLedgers! Too Low!",
      input,
      details: `The validForLedgers '${validForLedgers}' is invalid. It must be a valid ledger sequence higher than 0.`,
    });
  }
}

export class VALID_FOR_SECONDS_TOO_LOW extends SignAuthEntriesError {
  constructor(input: SignAuthEntriesInput, validForSeconds: number) {
    super({
      code: Code.VALID_FOR_SECONDS_TOO_LOW,
      message: "Invalid validForSeconds! Too Low!",
      input,
      details: `The validForSeconds '${validForSeconds}' is invalid. It must be a valid number of seconds higher than 5 so it is valid for at least 1 ledger.`,
    });
  }
}

export class FAILED_TO_FETCH_LATEST_LEDGER extends SignAuthEntriesError {
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

export class MISSING_SIGNER extends SignAuthEntriesError {
  override readonly meta: {
    data: {
      input: SignAuthEntriesInput;
      authEntryXDR: string;
    };
    cause: null;
  };
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

export class FAILED_TO_SIGN_AUTH_ENTRY extends SignAuthEntriesError {
  override readonly meta: {
    data: {
      input: SignAuthEntriesInput;
      authEntryXDR: string;
    };
    cause: Error;
  };

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
