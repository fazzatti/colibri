/**
 * SEP-10 Client Errors
 *
 * Errors specific to network operations when interacting with SEP-10 auth servers.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

import { ColibriError } from "@colibri/core";
import type { Diagnostic } from "@colibri/core";

export type Meta<DataType = unknown> = {
  cause: Error | null;
  data: DataType;
};

export type ClientErrorShape<Code extends string, DataType = unknown> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data?: DataType;
};

export abstract class ClientError<
  C extends string = Code,
  DataType = unknown
> extends ColibriError<C, Meta<DataType>> {
  override readonly source = "@colibri/sep10/client";
  override readonly meta: Meta<DataType>;

  constructor(args: ClientErrorShape<C, DataType>) {
    const meta: Meta<DataType> = {
      cause: args.cause || null,
      data: args.data as DataType,
    };

    super({
      domain: "sep10" as const,
      source: "@colibri/sep10/client",
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
  // Network errors
  FETCH_CHALLENGE_FAILED = "SEP10_CLI_001",
  SUBMIT_CHALLENGE_FAILED = "SEP10_CLI_002",
  TIMEOUT = "SEP10_CLI_003",

  // Server response errors
  INVALID_SERVER_RESPONSE = "SEP10_CLI_004",
  MISSING_JWT = "SEP10_CLI_005",
  INVALID_JWT = "SEP10_CLI_006",

  // Configuration errors
  MISSING_AUTH_ENDPOINT = "SEP10_CLI_007",
  INVALID_TOML = "SEP10_CLI_008",
}

// =============================================================================
// Error Classes
// =============================================================================

export class FETCH_CHALLENGE_FAILED extends ClientError<
  Code.FETCH_CHALLENGE_FAILED,
  { url: string; statusCode?: number; statusText?: string }
> {
  constructor(
    url: string,
    cause?: Error,
    statusCode?: number,
    statusText?: string
  ) {
    super({
      code: Code.FETCH_CHALLENGE_FAILED,
      message: "Failed to fetch SEP-10 challenge",
      details: statusCode
        ? `HTTP request to '${url}' failed with status ${statusCode} ${
            statusText || ""
          }`
        : `Failed to fetch challenge from '${url}'`,
      diagnostic: {
        rootCause: cause?.message || "Network request failed",
        suggestion:
          "Verify the auth server is accessible and properly configured.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#authentication",
        ],
      },
      cause,
      data: { url, statusCode, statusText },
    });
  }
}

export class SUBMIT_CHALLENGE_FAILED extends ClientError<
  Code.SUBMIT_CHALLENGE_FAILED,
  { url: string; statusCode?: number; statusText?: string; body?: string }
> {
  constructor(
    url: string,
    cause?: Error,
    statusCode?: number,
    statusText?: string,
    body?: string
  ) {
    super({
      code: Code.SUBMIT_CHALLENGE_FAILED,
      message: "Failed to submit signed challenge",
      details: statusCode
        ? `HTTP POST to '${url}' failed with status ${statusCode} ${
            statusText || ""
          }`
        : `Failed to submit signed challenge to '${url}'`,
      diagnostic: {
        rootCause: cause?.message || body || "Server rejected the challenge",
        suggestion:
          "Ensure the challenge is properly signed with all required signatures.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#token",
        ],
      },
      cause,
      data: { url, statusCode, statusText, body },
    });
  }
}

export class TIMEOUT extends ClientError<
  Code.TIMEOUT,
  { url: string; timeoutMs: number }
> {
  constructor(url: string, timeoutMs: number) {
    super({
      code: Code.TIMEOUT,
      message: "Request timed out",
      details: `Request to '${url}' timed out after ${timeoutMs}ms.`,
      diagnostic: {
        rootCause: "The server did not respond in time",
        suggestion:
          "Check network connectivity or increase the timeout duration.",
        materials: [],
      },
      data: { url, timeoutMs },
    });
  }
}

export class INVALID_SERVER_RESPONSE extends ClientError<
  Code.INVALID_SERVER_RESPONSE,
  { url: string; response?: string }
> {
  constructor(url: string, response?: string) {
    super({
      code: Code.INVALID_SERVER_RESPONSE,
      message: "Invalid server response",
      details: `The server at '${url}' returned an invalid response.`,
      diagnostic: {
        rootCause: "Server response does not conform to SEP-10 specification",
        suggestion:
          "The server may be misconfigured or not a valid SEP-10 server.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md",
        ],
      },
      data: { url, response: response?.slice(0, 500) },
    });
  }
}

export class MISSING_JWT extends ClientError<
  Code.MISSING_JWT,
  { url: string }
> {
  constructor(url: string) {
    super({
      code: Code.MISSING_JWT,
      message: "Missing JWT in response",
      details: `The server at '${url}' did not return a JWT token.`,
      diagnostic: {
        rootCause: "Server response missing 'token' field",
        suggestion: "Ensure the challenge was properly signed and submitted.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#token",
        ],
      },
      data: { url },
    });
  }
}

export class INVALID_JWT extends ClientError<
  Code.INVALID_JWT,
  { jwt?: string; reason?: string }
> {
  constructor(jwt?: string, reason?: string) {
    super({
      code: Code.INVALID_JWT,
      message: "Invalid JWT token",
      details: reason || "The JWT token returned by the server is invalid.",
      diagnostic: {
        rootCause: reason || "JWT validation failed",
        suggestion:
          "The server may be misconfigured or the token has been tampered with.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#token",
        ],
      },
      data: { jwt: jwt?.slice(0, 100), reason },
    });
  }
}

export class MISSING_AUTH_ENDPOINT extends ClientError<
  Code.MISSING_AUTH_ENDPOINT,
  { domain: string }
> {
  constructor(domain: string) {
    super({
      code: Code.MISSING_AUTH_ENDPOINT,
      message: "Missing WEB_AUTH_ENDPOINT in stellar.toml",
      details: `The stellar.toml for '${domain}' does not specify a WEB_AUTH_ENDPOINT.`,
      diagnostic: {
        rootCause: "Domain does not support SEP-10 authentication",
        suggestion:
          "Verify the domain supports SEP-10 and has WEB_AUTH_ENDPOINT configured in stellar.toml.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#stellar-info-file",
        ],
      },
      data: { domain },
    });
  }
}

export class INVALID_TOML extends ClientError<
  Code.INVALID_TOML,
  { domain: string; field?: string }
> {
  constructor(domain: string, field?: string) {
    super({
      code: Code.INVALID_TOML,
      message: "Invalid stellar.toml configuration",
      details: field
        ? `The stellar.toml for '${domain}' has an invalid '${field}' field.`
        : `The stellar.toml for '${domain}' is invalid or incomplete for SEP-10.`,
      diagnostic: {
        rootCause: "stellar.toml configuration is invalid",
        suggestion:
          "Verify the domain's stellar.toml has valid WEB_AUTH_ENDPOINT and SIGNING_KEY fields.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#stellar-info-file",
        ],
      },
      data: { domain, field },
    });
  }
}

// =============================================================================
// Error Aggregator by Code
// =============================================================================

export const ERROR_SEP10_CLI = {
  [Code.FETCH_CHALLENGE_FAILED]: FETCH_CHALLENGE_FAILED,
  [Code.SUBMIT_CHALLENGE_FAILED]: SUBMIT_CHALLENGE_FAILED,
  [Code.TIMEOUT]: TIMEOUT,
  [Code.INVALID_SERVER_RESPONSE]: INVALID_SERVER_RESPONSE,
  [Code.MISSING_JWT]: MISSING_JWT,
  [Code.INVALID_JWT]: INVALID_JWT,
  [Code.MISSING_AUTH_ENDPOINT]: MISSING_AUTH_ENDPOINT,
  [Code.INVALID_TOML]: INVALID_TOML,
};
