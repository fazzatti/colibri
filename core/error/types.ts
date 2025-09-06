export type ErrorDomain =
  | "transformers"
  | "processes"
  | "verifiers"
  | "helpers"
  | "core"
  | "accounts"
  | "pipelines"
  | "rpc"
  | "contracts";

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
