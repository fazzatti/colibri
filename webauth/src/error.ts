import { ColibriError } from "@colibri/core";
import type { BaseMeta, Diagnostic } from "@colibri/core";
import type { WebAuthProtocol } from "@/types.ts";

/** @internal Exact Core metadata shape retained without re-exporting Core. */
export type WebAuthBaseMeta = BaseMeta;

/** @internal Exact Core diagnostic shape retained without re-exporting Core. */
export type WebAuthDiagnostic = Diagnostic;

/** Shared WebAuth error codes. */
export const WebAuthCode = {
  INVALID_ACCOUNT: "WEBAUTH_INVALID_ACCOUNT",
  UNSUPPORTED_ACCOUNT: "WEBAUTH_UNSUPPORTED_ACCOUNT",
  PROTOCOL_NOT_ADVERTISED: "WEBAUTH_PROTOCOL_NOT_ADVERTISED",
  INCOMPLETE_CONFIGURATION: "WEBAUTH_INCOMPLETE_CONFIGURATION",
  OPTION_MISMATCH: "WEBAUTH_OPTION_MISMATCH",
  NETWORK_MISMATCH: "WEBAUTH_NETWORK_MISMATCH",
  MISSING_RPC: "WEBAUTH_MISSING_RPC",
  TRANSPORT: "WEBAUTH_TRANSPORT",
  TIMEOUT: "WEBAUTH_TIMEOUT",
  INVALID_RESPONSE: "WEBAUTH_INVALID_RESPONSE",
  INVALID_TOKEN: "WEBAUTH_INVALID_TOKEN",
  TOKEN_CONTEXT_MISMATCH: "WEBAUTH_TOKEN_CONTEXT_MISMATCH",
  TOKEN_EXPIRED: "WEBAUTH_TOKEN_EXPIRED",
} as const;

/** SEP-10-specific error codes. */
export const Sep10Code = {
  INVALID_XDR: "SEP10_CHAL_INVALID_XDR",
  INVALID_SEQUENCE: "SEP10_CHAL_INVALID_SEQUENCE",
  TIMEBOUNDS_MISSING: "SEP10_CHAL_TIMEBOUNDS_MISSING",
  TIMEBOUNDS_INFINITE: "SEP10_CHAL_TIMEBOUNDS_INFINITE",
  NOT_YET_VALID: "SEP10_CHAL_NOT_YET_VALID",
  EXPIRED: "SEP10_CHAL_EXPIRED",
  NO_OPERATIONS: "SEP10_CHAL_NO_OPERATIONS",
  INVALID_OPERATION: "SEP10_CHAL_INVALID_OPERATION",
  INVALID_SERVER_ACCOUNT: "SEP10_CHAL_INVALID_SERVER_ACCOUNT",
  ACCOUNT_MISMATCH: "SEP10_CHAL_ACCOUNT_MISMATCH",
  MEMO_MISMATCH: "SEP10_CHAL_MEMO_MISMATCH",
  INVALID_HOME_DOMAIN: "SEP10_CHAL_INVALID_HOME_DOMAIN",
  INVALID_NONCE: "SEP10_CHAL_INVALID_NONCE",
  INVALID_SERVER_SIGNATURE: "SEP10_CHAL_INVALID_SERVER_SIGNATURE",
  INVALID_WEB_AUTH_DOMAIN: "SEP10_CHAL_INVALID_WEB_AUTH_DOMAIN",
  CLIENT_DOMAIN_UNEXPECTED: "SEP10_CHAL_CLIENT_DOMAIN_UNEXPECTED",
  CLIENT_DOMAIN_VALUE_MISMATCH: "SEP10_CHAL_CLIENT_DOMAIN_VALUE_MISMATCH",
  CLIENT_DOMAIN_DISCOVERY: "SEP10_CHAL_CLIENT_DOMAIN_DISCOVERY",
  CLIENT_DOMAIN_SIGNING_KEY: "SEP10_CHAL_CLIENT_DOMAIN_SIGNING_KEY",
  CLIENT_DOMAIN_SIGNER_MISSING: "SEP10_CLIENT_DOMAIN_SIGNER_MISSING",
  SIGNING_FAILED: "SEP10_SIGNING_FAILED",
  INVALID_STATE: "SEP10_INVALID_STATE",
  CLIENT_REQUEST_FAILED: "SEP10_CLIENT_REQUEST_FAILED",
} as const;

/** SEP-45-specific error codes. */
export const Sep45Code = {
  INVALID_XDR: "SEP45_CHAL_INVALID_XDR",
  EMPTY_ENTRIES: "SEP45_CHAL_EMPTY_ENTRIES",
  UNSUPPORTED_CREDENTIAL_TYPE: "SEP45_CHAL_UNSUPPORTED_CREDENTIAL_TYPE",
  INVALID_ROLE: "SEP45_CHAL_INVALID_ROLE",
  INVALID_INVOCATION: "SEP45_CHAL_INVALID_INVOCATION",
  INVALID_ARGUMENTS: "SEP45_CHAL_INVALID_ARGUMENTS",
  ARGUMENTS_MISMATCH: "SEP45_CHAL_ARGUMENTS_MISMATCH",
  ACCOUNT_MISMATCH: "SEP45_CHAL_ACCOUNT_MISMATCH",
  INVALID_SERVER_SIGNATURE: "SEP45_CHAL_INVALID_SERVER_SIGNATURE",
  SERVER_ENTRY_EXPIRED: "SEP45_CHAL_SERVER_ENTRY_EXPIRED",
  CLIENT_DOMAIN_UNEXPECTED: "SEP45_CHAL_CLIENT_DOMAIN_UNEXPECTED",
  CLIENT_DOMAIN_DISCOVERY: "SEP45_CHAL_CLIENT_DOMAIN_DISCOVERY",
  CLIENT_DOMAIN_SIGNING_KEY: "SEP45_CHAL_CLIENT_DOMAIN_SIGNING_KEY",
  AUTH_HANDLER_MISSING: "SEP45_AUTH_HANDLER_MISSING",
  AUTH_HANDLER_FAILED: "SEP45_AUTH_HANDLER_FAILED",
  INVALID_AUTHORIZED_ENTRY: "SEP45_AUTH_INVALID_RETURNED_ENTRY",
  INVALID_VALIDITY: "SEP45_AUTH_INVALID_VALIDITY",
  CLIENT_DOMAIN_SIGNER_MISSING: "SEP45_AUTH_CLIENT_DOMAIN_SIGNER_MISSING",
  AUTHORIZATION_EXPIRED: "SEP45_AUTH_EXPIRED",
  RPC_FAILED: "SEP45_SIM_RPC_FAILED",
  SIMULATION_FAILED: "SEP45_SIM_ENFORCEMENT_FAILED",
  UNSAFE_FOOTPRINT: "SEP45_SIM_UNSAFE_FOOTPRINT",
  INVALID_RESTORATION: "SEP45_SIM_INVALID_RESTORATION",
  INVALID_STATE: "SEP45_CLI_INVALID_STATE",
  CLIENT_REQUEST_FAILED: "SEP45_CLI_REQUEST_FAILED",
} as const;

/** Union of every stable code exported by this package. */
export type WebAuthErrorCode =
  | (typeof WebAuthCode)[keyof typeof WebAuthCode]
  | (typeof Sep10Code)[keyof typeof Sep10Code]
  | (typeof Sep45Code)[keyof typeof Sep45Code];

/** Structured metadata attached to WebAuth errors. */
export interface WebAuthErrorMeta extends WebAuthBaseMeta {
  /** Protocol involved in the failure. */
  protocol?: WebAuthProtocol;
  /** Endpoint involved in the failure. */
  endpoint?: string;
  /** Structured failure context. */
  data?: Record<string, unknown>;
}

/** Constructor input for package errors. */
export interface WebAuthErrorOptions {
  /** Stable package error code. */
  code: WebAuthErrorCode;
  /** Human-readable failure summary. */
  message: string;
  /** Optional expanded failure explanation. */
  details?: string;
  /** Protocol involved in the failure. */
  protocol?: WebAuthProtocol;
  /** Endpoint involved in the failure. */
  endpoint?: string;
  /** Structured failure context. */
  data?: Record<string, unknown>;
  /** Original thrown value. */
  cause?: unknown;
  /** Optional troubleshooting guidance. */
  diagnostic?: WebAuthDiagnostic;
}

/** @internal Core error base retained without re-exporting Core. */
export class WebAuthErrorBase
  extends ColibriError<WebAuthErrorCode, WebAuthErrorMeta> {}

/** Base class for all errors emitted by `@colibri/webauth`. */
export class WebAuthError extends WebAuthErrorBase {
  /** Protocol involved in the failure, when known. */
  readonly protocol?: WebAuthProtocol;

  /** Creates a typed WebAuth error. */
  constructor(options: WebAuthErrorOptions) {
    const meta: WebAuthErrorMeta = {
      cause: options.cause,
      protocol: options.protocol,
      endpoint: options.endpoint,
      data: options.data,
    };
    super({
      domain: "auth",
      source: "@colibri/webauth",
      code: options.code,
      message: options.message,
      details: options.details,
      diagnostic: options.diagnostic,
      meta,
    });
    this.name = `WebAuthError ${options.code}`;
    this.protocol = options.protocol;
  }
}

/** Base class for SEP-10-specific WebAuth errors. */
export class Sep10Error extends WebAuthError {
  /** Protocol associated with every SEP-10 error. */
  override readonly protocol = "sep10" as const;

  /** Creates a SEP-10 error. */
  constructor(options: Omit<WebAuthErrorOptions, "protocol">) {
    super({ ...options, protocol: "sep10" });
    this.name = `Sep10Error ${options.code}`;
  }
}

/** Base class for SEP-45-specific WebAuth errors. */
export class Sep45Error extends WebAuthError {
  /** Protocol associated with every SEP-45 error. */
  override readonly protocol = "sep45" as const;

  /** Creates a SEP-45 error. */
  constructor(options: Omit<WebAuthErrorOptions, "protocol">) {
    super({ ...options, protocol: "sep45" });
    this.name = `Sep45Error ${options.code}`;
  }
}
