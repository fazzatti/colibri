/**
 * SEP-10 Challenge Errors
 *
 * Errors specific to parsing, validating, and signing SEP-10 challenge transactions.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

import { ColibriError } from "@colibri/core";
import type { Diagnostic } from "@colibri/core";

export type Meta<DataType = unknown> = {
  cause: Error | null;
  data: DataType;
};

export type ChallengeErrorShape<Code extends string, DataType = unknown> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data?: DataType;
};

export abstract class ChallengeError<
  C extends string = Code,
  DataType = unknown
> extends ColibriError<C, Meta<DataType>> {
  override readonly source = "@colibri/sep10/challenge";
  override readonly meta: Meta<DataType>;

  constructor(args: ChallengeErrorShape<C, DataType>) {
    const meta: Meta<DataType> = {
      cause: args.cause || null,
      data: args.data as DataType,
    };

    super({
      domain: "sep10" as const,
      source: "@colibri/sep10/challenge",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }
}

export enum Code {
  INVALID_XDR = "SEP10_CHAL_001",
  INVALID_SEQUENCE = "SEP10_CHAL_002",
  MISSING_TIME_BOUNDS = "SEP10_CHAL_003",
  CHALLENGE_EXPIRED = "SEP10_CHAL_004",
  NO_OPERATIONS = "SEP10_CHAL_005",
  INVALID_FIRST_OPERATION = "SEP10_CHAL_006",
  CLIENT_ACCOUNT_MISMATCH = "SEP10_CHAL_007",
  INVALID_HOME_DOMAIN = "SEP10_CHAL_008",
  INVALID_NONCE = "SEP10_CHAL_009",
  INVALID_SERVER_SIGNATURE = "SEP10_CHAL_010",
  INVALID_WEB_AUTH_DOMAIN = "SEP10_CHAL_011",
  INVALID_CLIENT_DOMAIN = "SEP10_CHAL_012",
  INVALID_OPERATION_SOURCE = "SEP10_CHAL_013",
  INVALID_MEMO_TYPE = "SEP10_CHAL_014",
  MUXED_ACCOUNT_WITH_MEMO = "SEP10_CHAL_015",
  MISSING_SIGNATURE = "SEP10_CHAL_016",
}

// =============================================================================
// Error Classes
// =============================================================================

export class INVALID_XDR extends ChallengeError<
  Code.INVALID_XDR,
  { xdr?: string }
> {
  constructor(cause?: Error, xdr?: string) {
    super({
      code: Code.INVALID_XDR,
      message: "Invalid XDR encoding",
      details:
        "The provided string is not a valid base64-encoded Stellar transaction envelope.",
      diagnostic: {
        rootCause: cause?.message || "Failed to decode XDR",
        suggestion:
          "Ensure the challenge is a valid base64-encoded TransactionEnvelope XDR.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md",
        ],
      },
      cause,
      data: { xdr: xdr?.slice(0, 100) },
    });
  }
}

export class INVALID_SEQUENCE extends ChallengeError<
  Code.INVALID_SEQUENCE,
  { sequenceNumber: string }
> {
  constructor(sequenceNumber: string) {
    super({
      code: Code.INVALID_SEQUENCE,
      message: "Invalid sequence number",
      details: `Challenge transaction must have sequence number 0, but got '${sequenceNumber}'.`,
      diagnostic: {
        rootCause:
          "SEP-10 challenges must have sequence 0 to prevent execution on-chain",
        suggestion:
          "This may indicate a malicious transaction. Do not sign transactions with non-zero sequence numbers.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: { sequenceNumber },
    });
  }
}

export class MISSING_TIME_BOUNDS extends ChallengeError<
  Code.MISSING_TIME_BOUNDS,
  Record<string, never>
> {
  constructor() {
    super({
      code: Code.MISSING_TIME_BOUNDS,
      message: "Missing time bounds",
      details: "Challenge transaction must have time bounds set.",
      diagnostic: {
        rootCause: "Time bounds are required to prevent replay attacks",
        suggestion: "Request a new challenge from the server.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: {},
    });
  }
}

export class CHALLENGE_EXPIRED extends ChallengeError<
  Code.CHALLENGE_EXPIRED,
  {
    minTime: number;
    maxTime: number;
    now: number;
    expired: boolean;
    notYetValid: boolean;
  }
> {
  constructor(minTime: number, maxTime: number, now: number) {
    const expired = now > maxTime;
    const notYetValid = now < minTime;

    super({
      code: Code.CHALLENGE_EXPIRED,
      message: expired ? "Challenge has expired" : "Challenge not yet valid",
      details: expired
        ? `Challenge expired at ${new Date(
            maxTime * 1000
          ).toISOString()}. Current time: ${new Date(
            now * 1000
          ).toISOString()}.`
        : `Challenge not valid until ${new Date(
            minTime * 1000
          ).toISOString()}. Current time: ${new Date(
            now * 1000
          ).toISOString()}.`,
      diagnostic: {
        rootCause: expired
          ? "The challenge transaction's time bounds have passed"
          : "The challenge transaction's time bounds have not started",
        suggestion: "Request a new challenge from the server.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: { minTime, maxTime, now, expired, notYetValid },
    });
  }
}

export class NO_OPERATIONS extends ChallengeError<
  Code.NO_OPERATIONS,
  Record<string, never>
> {
  constructor() {
    super({
      code: Code.NO_OPERATIONS,
      message: "No operations in challenge",
      details: "Challenge transaction must contain at least one operation.",
      diagnostic: {
        rootCause: "A valid SEP-10 challenge requires ManageData operations",
        suggestion: "Request a new challenge from the server.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: {},
    });
  }
}

export class INVALID_FIRST_OPERATION extends ChallengeError<
  Code.INVALID_FIRST_OPERATION,
  { operationType: string }
> {
  constructor(operationType: string) {
    super({
      code: Code.INVALID_FIRST_OPERATION,
      message: "Invalid first operation type",
      details: `First operation must be ManageData, but got '${operationType}'.`,
      diagnostic: {
        rootCause: "SEP-10 challenges must start with a ManageData operation",
        suggestion:
          "The server may be misconfigured or this is not a valid SEP-10 challenge.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: { operationType },
    });
  }
}

export class CLIENT_ACCOUNT_MISMATCH extends ChallengeError<
  Code.CLIENT_ACCOUNT_MISMATCH,
  { expected?: string; actual: string }
> {
  constructor(actual: string, expected?: string) {
    super({
      code: Code.CLIENT_ACCOUNT_MISMATCH,
      message: "Client account mismatch",
      details: expected
        ? `First operation source account '${actual}' does not match expected client account '${expected}'.`
        : `First operation must have a source account set to the client account, but got '${actual}'.`,
      diagnostic: {
        rootCause:
          "The first operation's source account must be the authenticating client",
        suggestion:
          "Ensure you're using the correct account or request a new challenge.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: { expected, actual },
    });
  }
}

export class INVALID_HOME_DOMAIN extends ChallengeError<
  Code.INVALID_HOME_DOMAIN,
  { expected?: string; actual: string }
> {
  constructor(actual: string, expected?: string) {
    super({
      code: Code.INVALID_HOME_DOMAIN,
      message: "Invalid home domain",
      details: expected
        ? `Home domain '${actual}' does not match expected '${expected}'.`
        : `First operation key '${actual}' does not follow '<domain> auth' format.`,
      diagnostic: {
        rootCause:
          "The first operation key must be '<home_domain> auth' where home_domain matches the expected domain",
        suggestion:
          "Verify you're connecting to the correct server or the server is properly configured.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: { expected, actual },
    });
  }
}

export class INVALID_NONCE extends ChallengeError<
  Code.INVALID_NONCE,
  { length: number }
> {
  constructor(length: number) {
    super({
      code: Code.INVALID_NONCE,
      message: "Invalid nonce length",
      details: `Nonce must be 64 bytes, but got ${length} bytes.`,
      diagnostic: {
        rootCause:
          "SEP-10 requires a 48-byte random value base64-encoded to 64 bytes",
        suggestion: "Request a new challenge from the server.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: { length },
    });
  }
}

export class INVALID_SERVER_SIGNATURE extends ChallengeError<
  Code.INVALID_SERVER_SIGNATURE,
  { serverAccount: string }
> {
  constructor(serverAccount: string, cause?: Error) {
    super({
      code: Code.INVALID_SERVER_SIGNATURE,
      message: "Invalid server signature",
      details: `Challenge is not properly signed by server account '${serverAccount}'.`,
      diagnostic: {
        rootCause: cause?.message || "Server signature verification failed",
        suggestion:
          "The challenge may have been tampered with or the server's signing key doesn't match the expected key.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      cause,
      data: { serverAccount },
    });
  }
}

export class INVALID_WEB_AUTH_DOMAIN extends ChallengeError<
  Code.INVALID_WEB_AUTH_DOMAIN,
  { expected?: string; actual?: string; sourceAccount?: string }
> {
  constructor(
    options: { expected?: string; actual?: string; sourceAccount?: string } = {}
  ) {
    const { expected, actual, sourceAccount } = options;
    let details: string;

    if (sourceAccount) {
      details = `web_auth_domain operation source account must be the server account, but got '${sourceAccount}'.`;
    } else if (expected && actual) {
      details = `web_auth_domain '${actual}' does not match expected '${expected}'.`;
    } else {
      details = "web_auth_domain operation is invalid.";
    }

    super({
      code: Code.INVALID_WEB_AUTH_DOMAIN,
      message: "Invalid web_auth_domain",
      details,
      diagnostic: {
        rootCause:
          "The web_auth_domain operation must be sourced from the server account",
        suggestion:
          "Verify the server is properly configured or you're connecting to the correct server.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: { expected, actual, sourceAccount },
    });
  }
}

export class INVALID_CLIENT_DOMAIN extends ChallengeError<
  Code.INVALID_CLIENT_DOMAIN,
  { clientDomainAccount?: string; sourceAccount?: string }
> {
  constructor(options: {
    clientDomainAccount?: string;
    sourceAccount?: string;
  }) {
    const { clientDomainAccount, sourceAccount } = options;

    super({
      code: Code.INVALID_CLIENT_DOMAIN,
      message: "Invalid client_domain operation",
      details: `client_domain operation source account '${sourceAccount}' does not match expected client domain account '${clientDomainAccount}'.`,
      diagnostic: {
        rootCause:
          "The client_domain operation's source account must be the client domain's SIGNING_KEY",
        suggestion:
          "Verify the client domain's stellar.toml SIGNING_KEY matches the operation source.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#verifying-the-client-domain",
        ],
      },
      data: { clientDomainAccount, sourceAccount },
    });
  }
}

export class INVALID_OPERATION_SOURCE extends ChallengeError<
  Code.INVALID_OPERATION_SOURCE,
  { operationKey: string; sourceAccount: string; expectedAccount: string }
> {
  constructor(
    operationKey: string,
    sourceAccount: string,
    expectedAccount: string
  ) {
    super({
      code: Code.INVALID_OPERATION_SOURCE,
      message: "Invalid operation source account",
      details: `Operation '${operationKey}' has source account '${sourceAccount}', but expected '${expectedAccount}'.`,
      diagnostic: {
        rootCause:
          "Additional ManageData operations must have the server account as source",
        suggestion:
          "The challenge transaction may be malformed or tampered with.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge",
        ],
      },
      data: { operationKey, sourceAccount, expectedAccount },
    });
  }
}

export class INVALID_MEMO_TYPE extends ChallengeError<
  Code.INVALID_MEMO_TYPE,
  { memoType: string }
> {
  constructor(memoType: string) {
    super({
      code: Code.INVALID_MEMO_TYPE,
      message: "Invalid memo type",
      details: `Memo must be of type 'id', but got '${memoType}'.`,
      diagnostic: {
        rootCause: "SEP-10 only supports id-type memos for shared accounts",
        suggestion:
          "Request a new challenge with a valid id memo or without a memo.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#memos",
        ],
      },
      data: { memoType },
    });
  }
}

export class MUXED_ACCOUNT_WITH_MEMO extends ChallengeError<
  Code.MUXED_ACCOUNT_WITH_MEMO,
  { account: string; memo: string }
> {
  constructor(account: string, memo: string) {
    super({
      code: Code.MUXED_ACCOUNT_WITH_MEMO,
      message: "Muxed account cannot have memo",
      details: `Muxed account '${account}' was used with memo '${memo}'. Muxed accounts already contain the user identifier.`,
      diagnostic: {
        rootCause:
          "Muxed accounts (M...) embed the user ID, making memos redundant",
        suggestion: "Use either a muxed account OR a memo, not both.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#muxed-accounts",
        ],
      },
      data: { account, memo },
    });
  }
}

export class MISSING_SIGNATURE extends ChallengeError<
  Code.MISSING_SIGNATURE,
  { account: string }
> {
  constructor(account: string) {
    super({
      code: Code.MISSING_SIGNATURE,
      message: "Missing required signature",
      details: `Challenge is missing a signature from account '${account}'.`,
      diagnostic: {
        rootCause: "The challenge transaction requires additional signatures",
        suggestion:
          "Sign the challenge with the required account's secret key.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#token",
        ],
      },
      data: { account },
    });
  }
}

// =============================================================================
// Error Aggregator by Code
// =============================================================================

export const ERROR_SEP10_CHAL = {
  [Code.INVALID_XDR]: INVALID_XDR,
  [Code.INVALID_SEQUENCE]: INVALID_SEQUENCE,
  [Code.MISSING_TIME_BOUNDS]: MISSING_TIME_BOUNDS,
  [Code.CHALLENGE_EXPIRED]: CHALLENGE_EXPIRED,
  [Code.NO_OPERATIONS]: NO_OPERATIONS,
  [Code.INVALID_FIRST_OPERATION]: INVALID_FIRST_OPERATION,
  [Code.CLIENT_ACCOUNT_MISMATCH]: CLIENT_ACCOUNT_MISMATCH,
  [Code.INVALID_HOME_DOMAIN]: INVALID_HOME_DOMAIN,
  [Code.INVALID_NONCE]: INVALID_NONCE,
  [Code.INVALID_SERVER_SIGNATURE]: INVALID_SERVER_SIGNATURE,
  [Code.INVALID_WEB_AUTH_DOMAIN]: INVALID_WEB_AUTH_DOMAIN,
  [Code.INVALID_CLIENT_DOMAIN]: INVALID_CLIENT_DOMAIN,
  [Code.INVALID_OPERATION_SOURCE]: INVALID_OPERATION_SOURCE,
  [Code.INVALID_MEMO_TYPE]: INVALID_MEMO_TYPE,
  [Code.MUXED_ACCOUNT_WITH_MEMO]: MUXED_ACCOUNT_WITH_MEMO,
  [Code.MISSING_SIGNATURE]: MISSING_SIGNATURE,
};
