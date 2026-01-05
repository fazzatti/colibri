export type ErrorDomain =
  | "account"
  | "contract"
  | "transformers"
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
  | "sep1";

export type BaseMeta = {
  cause?: unknown; // chained errors
  data?: unknown; // domain-specific payload
};

export interface ColibriErrorShape<Code extends string, Meta extends BaseMeta> {
  domain: ErrorDomain;
  code: Code; // ex: "CC_001"
  message: string;
  source: string; // ex: "@colibri/core"
  details?: string;
  diagnostic?: Diagnostic;
  meta?: Meta;
}

export type Diagnostic = {
  rootCause: string;
  suggestion: string;
  materials?: string[];
};
