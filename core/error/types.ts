/**
 * Top-level Colibri error domains.
 */
export type ErrorDomain =
  | "account"
  | "address"
  | "auth"
  | "contract"
  | "tools"
  | "processes"
  | "verifiers"
  | "helpers"
  | "core"
  | "signer"
  | "pipelines"
  | "plugins"
  | "rpc"
  | "events"
  | "toid"
  | "event-streamer"
  | "ledger-streamer"
  | "sep1"
  | "sep10";

/**
 * Common metadata carried by Colibri errors.
 */
export type BaseMeta = {
  cause?: unknown; // chained errors
  data?: unknown; // domain-specific payload
};

/**
 * Constructor shape accepted by {@link ColibriError}.
 *
 * @typeParam Code - Stable error code type.
 * @typeParam Meta - Structured metadata carried by the error.
 */
export interface ColibriErrorShape<Code extends string, Meta extends BaseMeta> {
  /** High-level Colibri domain the error belongs to. */
  domain: ErrorDomain;
  /** Stable error code. */
  code: Code; // ex: "CC_001"
  /** Human-readable error message. */
  message: string;
  /** Source identifier for the subsystem that produced the error. */
  source: string; // ex: "@colibri/core"
  /** Optional expanded details for the failure. */
  details?: string;
  /** Optional diagnostic hints for remediation. */
  diagnostic?: Diagnostic;
  /** Optional structured metadata payload. */
  meta?: Meta;
}

/**
 * User-facing diagnostic hints attached to structured Colibri errors.
 */
export type Diagnostic = {
  /** Short explanation of the underlying failure. */
  rootCause: string;
  /** Suggested remediation for the caller. */
  suggestion: string;
  /** Optional external references or remediation materials. */
  materials?: string[];
};
