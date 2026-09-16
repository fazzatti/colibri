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
  RESPONSE_BODY_FAILED: "WEBAUTH_RESPONSE_BODY_FAILED",
  TIMEOUT: "WEBAUTH_TIMEOUT",
  INVALID_RESPONSE: "WEBAUTH_INVALID_RESPONSE",
  INVALID_TOKEN: "WEBAUTH_INVALID_TOKEN",
  INVALID_TOKEN_PAYLOAD_TYPE: "WEBAUTH_INVALID_TOKEN_PAYLOAD_TYPE",
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
  SERVER_SIGNATURE_NOT_VECTOR: "SEP45_CHAL_SERVER_SIGNATURE_NOT_VECTOR",
  NO_MATCHING_SERVER_SIGNATURE: "SEP45_CHAL_NO_MATCHING_SERVER_SIGNATURE",
  FAILED_TO_VERIFY_SERVER_SIGNATURE:
    "SEP45_CHAL_FAILED_TO_VERIFY_SERVER_SIGNATURE",
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

  /** @deprecated Use a concrete subclass. Retained as a source-compatible extension point. */
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

  /** @deprecated Use a concrete SEP-10 subclass. */
  constructor(options: Omit<WebAuthErrorOptions, "protocol">) {
    super({ ...options, protocol: "sep10" });
    this.name = `Sep10Error ${options.code}`;
  }
}

/** Base class for SEP-45-specific WebAuth errors. */
export class Sep45Error extends WebAuthError {
  /** Protocol associated with every SEP-45 error. */
  override readonly protocol = "sep45" as const;

  /** @deprecated Use a concrete SEP-45 subclass. */
  constructor(options: Omit<WebAuthErrorOptions, "protocol">) {
    super({ ...options, protocol: "sep45" });
    this.name = `Sep45Error ${options.code}`;
  }
}

/** Invalid account. Stable code `WEBAUTH_INVALID_ACCOUNT`. */
export class WebAuthInvalidAccountError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.INVALID_ACCOUNT });
  }
}

/** Unsupported account. Stable code `WEBAUTH_UNSUPPORTED_ACCOUNT`. */
export class WebAuthUnsupportedAccountError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.UNSUPPORTED_ACCOUNT });
  }
}

/** Protocol not advertised. Stable code `WEBAUTH_PROTOCOL_NOT_ADVERTISED`. */
export class WebAuthProtocolNotAdvertisedError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.PROTOCOL_NOT_ADVERTISED });
  }
}

/** Incomplete configuration. Stable code `WEBAUTH_INCOMPLETE_CONFIGURATION`. */
export class WebAuthIncompleteConfigurationError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.INCOMPLETE_CONFIGURATION });
  }
}

/** Option mismatch. Stable code `WEBAUTH_OPTION_MISMATCH`. */
export class WebAuthOptionMismatchError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.OPTION_MISMATCH });
  }
}

/** Network mismatch. Stable code `WEBAUTH_NETWORK_MISMATCH`. */
export class WebAuthNetworkMismatchError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.NETWORK_MISMATCH });
  }
}

/** Missing rpc. Stable code `WEBAUTH_MISSING_RPC`. */
export class WebAuthMissingRpcError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.MISSING_RPC });
  }
}

/** Transport. Stable code `WEBAUTH_TRANSPORT`. */
export class WebAuthTransportError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.TRANSPORT });
  }
}

/** Response body failed. Stable code `WEBAUTH_RESPONSE_BODY_FAILED`. */
export class WebAuthResponseBodyFailedError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.RESPONSE_BODY_FAILED });
  }
}

/** Timeout. Stable code `WEBAUTH_TIMEOUT`. */
export class WebAuthTimeoutError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.TIMEOUT });
  }
}

/** Invalid response. Stable code `WEBAUTH_INVALID_RESPONSE`. */
export class WebAuthInvalidResponseError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.INVALID_RESPONSE });
  }
}

/** Invalid token. Stable code `WEBAUTH_INVALID_TOKEN`. */
export class WebAuthInvalidTokenError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.INVALID_TOKEN });
  }
}

/** Invalid token payload type. Stable code `WEBAUTH_INVALID_TOKEN_PAYLOAD_TYPE`. */
export class WebAuthInvalidTokenPayloadTypeError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.INVALID_TOKEN_PAYLOAD_TYPE });
  }
}

/** Token context mismatch. Stable code `WEBAUTH_TOKEN_CONTEXT_MISMATCH`. */
export class WebAuthTokenContextMismatchError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.TOKEN_CONTEXT_MISMATCH });
  }
}

/** Token expired. Stable code `WEBAUTH_TOKEN_EXPIRED`. */
export class WebAuthTokenExpiredError extends WebAuthError {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code">) {
    super({ ...options, code: WebAuthCode.TOKEN_EXPIRED });
  }
}

/** Invalid xdr. Stable code `SEP10_CHAL_INVALID_XDR`. */
export class Sep10InvalidXdrError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.INVALID_XDR });
  }
}

/** Invalid sequence. Stable code `SEP10_CHAL_INVALID_SEQUENCE`. */
export class Sep10InvalidSequenceError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.INVALID_SEQUENCE });
  }
}

/** Timebounds missing. Stable code `SEP10_CHAL_TIMEBOUNDS_MISSING`. */
export class Sep10TimeboundsMissingError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.TIMEBOUNDS_MISSING });
  }
}

/** Timebounds infinite. Stable code `SEP10_CHAL_TIMEBOUNDS_INFINITE`. */
export class Sep10TimeboundsInfiniteError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.TIMEBOUNDS_INFINITE });
  }
}

/** Not yet valid. Stable code `SEP10_CHAL_NOT_YET_VALID`. */
export class Sep10NotYetValidError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.NOT_YET_VALID });
  }
}

/** Expired. Stable code `SEP10_CHAL_EXPIRED`. */
export class Sep10ExpiredError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.EXPIRED });
  }
}

/** No operations. Stable code `SEP10_CHAL_NO_OPERATIONS`. */
export class Sep10NoOperationsError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.NO_OPERATIONS });
  }
}

/** Invalid operation. Stable code `SEP10_CHAL_INVALID_OPERATION`. */
export class Sep10InvalidOperationError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.INVALID_OPERATION });
  }
}

/** Invalid server account. Stable code `SEP10_CHAL_INVALID_SERVER_ACCOUNT`. */
export class Sep10InvalidServerAccountError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.INVALID_SERVER_ACCOUNT });
  }
}

/** Account mismatch. Stable code `SEP10_CHAL_ACCOUNT_MISMATCH`. */
export class Sep10AccountMismatchError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.ACCOUNT_MISMATCH });
  }
}

/** Memo mismatch. Stable code `SEP10_CHAL_MEMO_MISMATCH`. */
export class Sep10MemoMismatchError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.MEMO_MISMATCH });
  }
}

/** Invalid home domain. Stable code `SEP10_CHAL_INVALID_HOME_DOMAIN`. */
export class Sep10InvalidHomeDomainError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.INVALID_HOME_DOMAIN });
  }
}

/** Invalid nonce. Stable code `SEP10_CHAL_INVALID_NONCE`. */
export class Sep10InvalidNonceError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.INVALID_NONCE });
  }
}

/** Invalid server signature. Stable code `SEP10_CHAL_INVALID_SERVER_SIGNATURE`. */
export class Sep10InvalidServerSignatureError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.INVALID_SERVER_SIGNATURE });
  }
}

/** Invalid web auth domain. Stable code `SEP10_CHAL_INVALID_WEB_AUTH_DOMAIN`. */
export class Sep10InvalidWebAuthDomainError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.INVALID_WEB_AUTH_DOMAIN });
  }
}

/** Client domain unexpected. Stable code `SEP10_CHAL_CLIENT_DOMAIN_UNEXPECTED`. */
export class Sep10ClientDomainUnexpectedError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.CLIENT_DOMAIN_UNEXPECTED });
  }
}

/** Client domain value mismatch. Stable code `SEP10_CHAL_CLIENT_DOMAIN_VALUE_MISMATCH`. */
export class Sep10ClientDomainValueMismatchError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.CLIENT_DOMAIN_VALUE_MISMATCH });
  }
}

/** Client domain discovery. Stable code `SEP10_CHAL_CLIENT_DOMAIN_DISCOVERY`. */
export class Sep10ClientDomainDiscoveryError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.CLIENT_DOMAIN_DISCOVERY });
  }
}

/** Client domain signing key. Stable code `SEP10_CHAL_CLIENT_DOMAIN_SIGNING_KEY`. */
export class Sep10ClientDomainSigningKeyError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.CLIENT_DOMAIN_SIGNING_KEY });
  }
}

/** Client domain signer missing. Stable code `SEP10_CLIENT_DOMAIN_SIGNER_MISSING`. */
export class Sep10ClientDomainSignerMissingError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.CLIENT_DOMAIN_SIGNER_MISSING });
  }
}

/** Signing failed. Stable code `SEP10_SIGNING_FAILED`. */
export class Sep10SigningFailedError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.SIGNING_FAILED });
  }
}

/** Invalid state. Stable code `SEP10_INVALID_STATE`. */
export class Sep10InvalidStateError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.INVALID_STATE });
  }
}

/** Client request failed. Stable code `SEP10_CLIENT_REQUEST_FAILED`. */
export class Sep10ClientRequestFailedError extends Sep10Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep10Code.CLIENT_REQUEST_FAILED });
  }
}

/** Invalid xdr. Stable code `SEP45_CHAL_INVALID_XDR`. */
export class Sep45InvalidXdrError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.INVALID_XDR });
  }
}

/** Empty entries. Stable code `SEP45_CHAL_EMPTY_ENTRIES`. */
export class Sep45EmptyEntriesError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.EMPTY_ENTRIES });
  }
}

/** Unsupported credential type. Stable code `SEP45_CHAL_UNSUPPORTED_CREDENTIAL_TYPE`. */
export class Sep45UnsupportedCredentialTypeError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.UNSUPPORTED_CREDENTIAL_TYPE });
  }
}

/** Invalid role. Stable code `SEP45_CHAL_INVALID_ROLE`. */
export class Sep45InvalidRoleError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.INVALID_ROLE });
  }
}

/** Invalid invocation. Stable code `SEP45_CHAL_INVALID_INVOCATION`. */
export class Sep45InvalidInvocationError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.INVALID_INVOCATION });
  }
}

/** Invalid arguments. Stable code `SEP45_CHAL_INVALID_ARGUMENTS`. */
export class Sep45InvalidArgumentsError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.INVALID_ARGUMENTS });
  }
}

/** Arguments mismatch. Stable code `SEP45_CHAL_ARGUMENTS_MISMATCH`. */
export class Sep45ArgumentsMismatchError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.ARGUMENTS_MISMATCH });
  }
}

/** Account mismatch. Stable code `SEP45_CHAL_ACCOUNT_MISMATCH`. */
export class Sep45AccountMismatchError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.ACCOUNT_MISMATCH });
  }
}

/** Invalid server signature. Stable code `SEP45_CHAL_INVALID_SERVER_SIGNATURE`. */
export class Sep45InvalidServerSignatureError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.INVALID_SERVER_SIGNATURE });
  }
}

/** Server signature not vector. Stable code `SEP45_CHAL_SERVER_SIGNATURE_NOT_VECTOR`. */
export class Sep45ServerSignatureNotVectorError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.SERVER_SIGNATURE_NOT_VECTOR });
  }
}

/** No matching server signature. Stable code `SEP45_CHAL_NO_MATCHING_SERVER_SIGNATURE`. */
export class Sep45NoMatchingServerSignatureError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.NO_MATCHING_SERVER_SIGNATURE });
  }
}

/** Failed to verify server signature. Stable code `SEP45_CHAL_FAILED_TO_VERIFY_SERVER_SIGNATURE`. */
export class Sep45FailedToVerifyServerSignatureError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.FAILED_TO_VERIFY_SERVER_SIGNATURE });
  }
}

/** Server entry expired. Stable code `SEP45_CHAL_SERVER_ENTRY_EXPIRED`. */
export class Sep45ServerEntryExpiredError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.SERVER_ENTRY_EXPIRED });
  }
}

/** Client domain unexpected. Stable code `SEP45_CHAL_CLIENT_DOMAIN_UNEXPECTED`. */
export class Sep45ClientDomainUnexpectedError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.CLIENT_DOMAIN_UNEXPECTED });
  }
}

/** Client domain discovery. Stable code `SEP45_CHAL_CLIENT_DOMAIN_DISCOVERY`. */
export class Sep45ClientDomainDiscoveryError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.CLIENT_DOMAIN_DISCOVERY });
  }
}

/** Client domain signing key. Stable code `SEP45_CHAL_CLIENT_DOMAIN_SIGNING_KEY`. */
export class Sep45ClientDomainSigningKeyError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.CLIENT_DOMAIN_SIGNING_KEY });
  }
}

/** Auth handler missing. Stable code `SEP45_AUTH_HANDLER_MISSING`. */
export class Sep45AuthHandlerMissingError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.AUTH_HANDLER_MISSING });
  }
}

/** Auth handler failed. Stable code `SEP45_AUTH_HANDLER_FAILED`. */
export class Sep45AuthHandlerFailedError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.AUTH_HANDLER_FAILED });
  }
}

/** Invalid authorized entry. Stable code `SEP45_AUTH_INVALID_RETURNED_ENTRY`. */
export class Sep45InvalidAuthorizedEntryError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.INVALID_AUTHORIZED_ENTRY });
  }
}

/** Invalid validity. Stable code `SEP45_AUTH_INVALID_VALIDITY`. */
export class Sep45InvalidValidityError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.INVALID_VALIDITY });
  }
}

/** Client domain signer missing. Stable code `SEP45_AUTH_CLIENT_DOMAIN_SIGNER_MISSING`. */
export class Sep45ClientDomainSignerMissingError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.CLIENT_DOMAIN_SIGNER_MISSING });
  }
}

/** Authorization expired. Stable code `SEP45_AUTH_EXPIRED`. */
export class Sep45AuthorizationExpiredError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.AUTHORIZATION_EXPIRED });
  }
}

/** Rpc failed. Stable code `SEP45_SIM_RPC_FAILED`. */
export class Sep45RpcFailedError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.RPC_FAILED });
  }
}

/** Simulation failed. Stable code `SEP45_SIM_ENFORCEMENT_FAILED`. */
export class Sep45SimulationFailedError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.SIMULATION_FAILED });
  }
}

/** Unsafe footprint. Stable code `SEP45_SIM_UNSAFE_FOOTPRINT`. */
export class Sep45UnsafeFootprintError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.UNSAFE_FOOTPRINT });
  }
}

/** Invalid restoration. Stable code `SEP45_SIM_INVALID_RESTORATION`. */
export class Sep45InvalidRestorationError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.INVALID_RESTORATION });
  }
}

/** Invalid state. Stable code `SEP45_CLI_INVALID_STATE`. */
export class Sep45InvalidStateError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.INVALID_STATE });
  }
}

/** Client request failed. Stable code `SEP45_CLI_REQUEST_FAILED`. */
export class Sep45ClientRequestFailedError extends Sep45Error {
  /** Construct this failure while preserving protocol, cause and diagnostics. */
  constructor(options: Omit<WebAuthErrorOptions, "code" | "protocol">) {
    super({ ...options, code: Sep45Code.CLIENT_REQUEST_FAILED });
  }
}

/** Stable code-to-concrete-class registry for every WebAuth protocol. */
export const WebAuthErrors: {
  ["WEBAUTH_INVALID_ACCOUNT"]: typeof WebAuthInvalidAccountError;
  ["WEBAUTH_UNSUPPORTED_ACCOUNT"]: typeof WebAuthUnsupportedAccountError;
  ["WEBAUTH_PROTOCOL_NOT_ADVERTISED"]: typeof WebAuthProtocolNotAdvertisedError;
  ["WEBAUTH_INCOMPLETE_CONFIGURATION"]:
    typeof WebAuthIncompleteConfigurationError;
  ["WEBAUTH_OPTION_MISMATCH"]: typeof WebAuthOptionMismatchError;
  ["WEBAUTH_NETWORK_MISMATCH"]: typeof WebAuthNetworkMismatchError;
  ["WEBAUTH_MISSING_RPC"]: typeof WebAuthMissingRpcError;
  ["WEBAUTH_TRANSPORT"]: typeof WebAuthTransportError;
  ["WEBAUTH_RESPONSE_BODY_FAILED"]: typeof WebAuthResponseBodyFailedError;
  ["WEBAUTH_TIMEOUT"]: typeof WebAuthTimeoutError;
  ["WEBAUTH_INVALID_RESPONSE"]: typeof WebAuthInvalidResponseError;
  ["WEBAUTH_INVALID_TOKEN"]: typeof WebAuthInvalidTokenError;
  ["WEBAUTH_INVALID_TOKEN_PAYLOAD_TYPE"]:
    typeof WebAuthInvalidTokenPayloadTypeError;
  ["WEBAUTH_TOKEN_CONTEXT_MISMATCH"]: typeof WebAuthTokenContextMismatchError;
  ["WEBAUTH_TOKEN_EXPIRED"]: typeof WebAuthTokenExpiredError;
  ["SEP10_CHAL_INVALID_XDR"]: typeof Sep10InvalidXdrError;
  ["SEP10_CHAL_INVALID_SEQUENCE"]: typeof Sep10InvalidSequenceError;
  ["SEP10_CHAL_TIMEBOUNDS_MISSING"]: typeof Sep10TimeboundsMissingError;
  ["SEP10_CHAL_TIMEBOUNDS_INFINITE"]: typeof Sep10TimeboundsInfiniteError;
  ["SEP10_CHAL_NOT_YET_VALID"]: typeof Sep10NotYetValidError;
  ["SEP10_CHAL_EXPIRED"]: typeof Sep10ExpiredError;
  ["SEP10_CHAL_NO_OPERATIONS"]: typeof Sep10NoOperationsError;
  ["SEP10_CHAL_INVALID_OPERATION"]: typeof Sep10InvalidOperationError;
  ["SEP10_CHAL_INVALID_SERVER_ACCOUNT"]: typeof Sep10InvalidServerAccountError;
  ["SEP10_CHAL_ACCOUNT_MISMATCH"]: typeof Sep10AccountMismatchError;
  ["SEP10_CHAL_MEMO_MISMATCH"]: typeof Sep10MemoMismatchError;
  ["SEP10_CHAL_INVALID_HOME_DOMAIN"]: typeof Sep10InvalidHomeDomainError;
  ["SEP10_CHAL_INVALID_NONCE"]: typeof Sep10InvalidNonceError;
  ["SEP10_CHAL_INVALID_SERVER_SIGNATURE"]:
    typeof Sep10InvalidServerSignatureError;
  ["SEP10_CHAL_INVALID_WEB_AUTH_DOMAIN"]: typeof Sep10InvalidWebAuthDomainError;
  ["SEP10_CHAL_CLIENT_DOMAIN_UNEXPECTED"]:
    typeof Sep10ClientDomainUnexpectedError;
  ["SEP10_CHAL_CLIENT_DOMAIN_VALUE_MISMATCH"]:
    typeof Sep10ClientDomainValueMismatchError;
  ["SEP10_CHAL_CLIENT_DOMAIN_DISCOVERY"]:
    typeof Sep10ClientDomainDiscoveryError;
  ["SEP10_CHAL_CLIENT_DOMAIN_SIGNING_KEY"]:
    typeof Sep10ClientDomainSigningKeyError;
  ["SEP10_CLIENT_DOMAIN_SIGNER_MISSING"]:
    typeof Sep10ClientDomainSignerMissingError;
  ["SEP10_SIGNING_FAILED"]: typeof Sep10SigningFailedError;
  ["SEP10_INVALID_STATE"]: typeof Sep10InvalidStateError;
  ["SEP10_CLIENT_REQUEST_FAILED"]: typeof Sep10ClientRequestFailedError;
  ["SEP45_CHAL_INVALID_XDR"]: typeof Sep45InvalidXdrError;
  ["SEP45_CHAL_EMPTY_ENTRIES"]: typeof Sep45EmptyEntriesError;
  ["SEP45_CHAL_UNSUPPORTED_CREDENTIAL_TYPE"]:
    typeof Sep45UnsupportedCredentialTypeError;
  ["SEP45_CHAL_INVALID_ROLE"]: typeof Sep45InvalidRoleError;
  ["SEP45_CHAL_INVALID_INVOCATION"]: typeof Sep45InvalidInvocationError;
  ["SEP45_CHAL_INVALID_ARGUMENTS"]: typeof Sep45InvalidArgumentsError;
  ["SEP45_CHAL_ARGUMENTS_MISMATCH"]: typeof Sep45ArgumentsMismatchError;
  ["SEP45_CHAL_ACCOUNT_MISMATCH"]: typeof Sep45AccountMismatchError;
  ["SEP45_CHAL_INVALID_SERVER_SIGNATURE"]:
    typeof Sep45InvalidServerSignatureError;
  ["SEP45_CHAL_SERVER_SIGNATURE_NOT_VECTOR"]:
    typeof Sep45ServerSignatureNotVectorError;
  ["SEP45_CHAL_NO_MATCHING_SERVER_SIGNATURE"]:
    typeof Sep45NoMatchingServerSignatureError;
  ["SEP45_CHAL_FAILED_TO_VERIFY_SERVER_SIGNATURE"]:
    typeof Sep45FailedToVerifyServerSignatureError;
  ["SEP45_CHAL_SERVER_ENTRY_EXPIRED"]: typeof Sep45ServerEntryExpiredError;
  ["SEP45_CHAL_CLIENT_DOMAIN_UNEXPECTED"]:
    typeof Sep45ClientDomainUnexpectedError;
  ["SEP45_CHAL_CLIENT_DOMAIN_DISCOVERY"]:
    typeof Sep45ClientDomainDiscoveryError;
  ["SEP45_CHAL_CLIENT_DOMAIN_SIGNING_KEY"]:
    typeof Sep45ClientDomainSigningKeyError;
  ["SEP45_AUTH_HANDLER_MISSING"]: typeof Sep45AuthHandlerMissingError;
  ["SEP45_AUTH_HANDLER_FAILED"]: typeof Sep45AuthHandlerFailedError;
  ["SEP45_AUTH_INVALID_RETURNED_ENTRY"]:
    typeof Sep45InvalidAuthorizedEntryError;
  ["SEP45_AUTH_INVALID_VALIDITY"]: typeof Sep45InvalidValidityError;
  ["SEP45_AUTH_CLIENT_DOMAIN_SIGNER_MISSING"]:
    typeof Sep45ClientDomainSignerMissingError;
  ["SEP45_AUTH_EXPIRED"]: typeof Sep45AuthorizationExpiredError;
  ["SEP45_SIM_RPC_FAILED"]: typeof Sep45RpcFailedError;
  ["SEP45_SIM_ENFORCEMENT_FAILED"]: typeof Sep45SimulationFailedError;
  ["SEP45_SIM_UNSAFE_FOOTPRINT"]: typeof Sep45UnsafeFootprintError;
  ["SEP45_SIM_INVALID_RESTORATION"]: typeof Sep45InvalidRestorationError;
  ["SEP45_CLI_INVALID_STATE"]: typeof Sep45InvalidStateError;
  ["SEP45_CLI_REQUEST_FAILED"]: typeof Sep45ClientRequestFailedError;
} = {
  ["WEBAUTH_INVALID_ACCOUNT"]: WebAuthInvalidAccountError,
  ["WEBAUTH_UNSUPPORTED_ACCOUNT"]: WebAuthUnsupportedAccountError,
  ["WEBAUTH_PROTOCOL_NOT_ADVERTISED"]: WebAuthProtocolNotAdvertisedError,
  ["WEBAUTH_INCOMPLETE_CONFIGURATION"]: WebAuthIncompleteConfigurationError,
  ["WEBAUTH_OPTION_MISMATCH"]: WebAuthOptionMismatchError,
  ["WEBAUTH_NETWORK_MISMATCH"]: WebAuthNetworkMismatchError,
  ["WEBAUTH_MISSING_RPC"]: WebAuthMissingRpcError,
  ["WEBAUTH_TRANSPORT"]: WebAuthTransportError,
  ["WEBAUTH_RESPONSE_BODY_FAILED"]: WebAuthResponseBodyFailedError,
  ["WEBAUTH_TIMEOUT"]: WebAuthTimeoutError,
  ["WEBAUTH_INVALID_RESPONSE"]: WebAuthInvalidResponseError,
  ["WEBAUTH_INVALID_TOKEN"]: WebAuthInvalidTokenError,
  ["WEBAUTH_INVALID_TOKEN_PAYLOAD_TYPE"]: WebAuthInvalidTokenPayloadTypeError,
  ["WEBAUTH_TOKEN_CONTEXT_MISMATCH"]: WebAuthTokenContextMismatchError,
  ["WEBAUTH_TOKEN_EXPIRED"]: WebAuthTokenExpiredError,
  ["SEP10_CHAL_INVALID_XDR"]: Sep10InvalidXdrError,
  ["SEP10_CHAL_INVALID_SEQUENCE"]: Sep10InvalidSequenceError,
  ["SEP10_CHAL_TIMEBOUNDS_MISSING"]: Sep10TimeboundsMissingError,
  ["SEP10_CHAL_TIMEBOUNDS_INFINITE"]: Sep10TimeboundsInfiniteError,
  ["SEP10_CHAL_NOT_YET_VALID"]: Sep10NotYetValidError,
  ["SEP10_CHAL_EXPIRED"]: Sep10ExpiredError,
  ["SEP10_CHAL_NO_OPERATIONS"]: Sep10NoOperationsError,
  ["SEP10_CHAL_INVALID_OPERATION"]: Sep10InvalidOperationError,
  ["SEP10_CHAL_INVALID_SERVER_ACCOUNT"]: Sep10InvalidServerAccountError,
  ["SEP10_CHAL_ACCOUNT_MISMATCH"]: Sep10AccountMismatchError,
  ["SEP10_CHAL_MEMO_MISMATCH"]: Sep10MemoMismatchError,
  ["SEP10_CHAL_INVALID_HOME_DOMAIN"]: Sep10InvalidHomeDomainError,
  ["SEP10_CHAL_INVALID_NONCE"]: Sep10InvalidNonceError,
  ["SEP10_CHAL_INVALID_SERVER_SIGNATURE"]: Sep10InvalidServerSignatureError,
  ["SEP10_CHAL_INVALID_WEB_AUTH_DOMAIN"]: Sep10InvalidWebAuthDomainError,
  ["SEP10_CHAL_CLIENT_DOMAIN_UNEXPECTED"]: Sep10ClientDomainUnexpectedError,
  ["SEP10_CHAL_CLIENT_DOMAIN_VALUE_MISMATCH"]:
    Sep10ClientDomainValueMismatchError,
  ["SEP10_CHAL_CLIENT_DOMAIN_DISCOVERY"]: Sep10ClientDomainDiscoveryError,
  ["SEP10_CHAL_CLIENT_DOMAIN_SIGNING_KEY"]: Sep10ClientDomainSigningKeyError,
  ["SEP10_CLIENT_DOMAIN_SIGNER_MISSING"]: Sep10ClientDomainSignerMissingError,
  ["SEP10_SIGNING_FAILED"]: Sep10SigningFailedError,
  ["SEP10_INVALID_STATE"]: Sep10InvalidStateError,
  ["SEP10_CLIENT_REQUEST_FAILED"]: Sep10ClientRequestFailedError,
  ["SEP45_CHAL_INVALID_XDR"]: Sep45InvalidXdrError,
  ["SEP45_CHAL_EMPTY_ENTRIES"]: Sep45EmptyEntriesError,
  ["SEP45_CHAL_UNSUPPORTED_CREDENTIAL_TYPE"]:
    Sep45UnsupportedCredentialTypeError,
  ["SEP45_CHAL_INVALID_ROLE"]: Sep45InvalidRoleError,
  ["SEP45_CHAL_INVALID_INVOCATION"]: Sep45InvalidInvocationError,
  ["SEP45_CHAL_INVALID_ARGUMENTS"]: Sep45InvalidArgumentsError,
  ["SEP45_CHAL_ARGUMENTS_MISMATCH"]: Sep45ArgumentsMismatchError,
  ["SEP45_CHAL_ACCOUNT_MISMATCH"]: Sep45AccountMismatchError,
  ["SEP45_CHAL_INVALID_SERVER_SIGNATURE"]: Sep45InvalidServerSignatureError,
  ["SEP45_CHAL_SERVER_SIGNATURE_NOT_VECTOR"]:
    Sep45ServerSignatureNotVectorError,
  ["SEP45_CHAL_NO_MATCHING_SERVER_SIGNATURE"]:
    Sep45NoMatchingServerSignatureError,
  ["SEP45_CHAL_FAILED_TO_VERIFY_SERVER_SIGNATURE"]:
    Sep45FailedToVerifyServerSignatureError,
  ["SEP45_CHAL_SERVER_ENTRY_EXPIRED"]: Sep45ServerEntryExpiredError,
  ["SEP45_CHAL_CLIENT_DOMAIN_UNEXPECTED"]: Sep45ClientDomainUnexpectedError,
  ["SEP45_CHAL_CLIENT_DOMAIN_DISCOVERY"]: Sep45ClientDomainDiscoveryError,
  ["SEP45_CHAL_CLIENT_DOMAIN_SIGNING_KEY"]: Sep45ClientDomainSigningKeyError,
  ["SEP45_AUTH_HANDLER_MISSING"]: Sep45AuthHandlerMissingError,
  ["SEP45_AUTH_HANDLER_FAILED"]: Sep45AuthHandlerFailedError,
  ["SEP45_AUTH_INVALID_RETURNED_ENTRY"]: Sep45InvalidAuthorizedEntryError,
  ["SEP45_AUTH_INVALID_VALIDITY"]: Sep45InvalidValidityError,
  ["SEP45_AUTH_CLIENT_DOMAIN_SIGNER_MISSING"]:
    Sep45ClientDomainSignerMissingError,
  ["SEP45_AUTH_EXPIRED"]: Sep45AuthorizationExpiredError,
  ["SEP45_SIM_RPC_FAILED"]: Sep45RpcFailedError,
  ["SEP45_SIM_ENFORCEMENT_FAILED"]: Sep45SimulationFailedError,
  ["SEP45_SIM_UNSAFE_FOOTPRINT"]: Sep45UnsafeFootprintError,
  ["SEP45_SIM_INVALID_RESTORATION"]: Sep45InvalidRestorationError,
  ["SEP45_CLI_INVALID_STATE"]: Sep45InvalidStateError,
  ["SEP45_CLI_REQUEST_FAILED"]: Sep45ClientRequestFailedError,
};
