import type {
  BuildVerificationLimits,
  ResolvedVerificationSource,
  VerificationSource,
} from "../../core/types/index.ts";
import type { SourceRetrievalPolicy } from "../../core/policy/types.ts";

/** Input passed to a verification source provider. */
export type VerificationSourceProviderInput = {
  readonly source: VerificationSource;
  readonly strict: boolean;
  readonly limits: BuildVerificationLimits;
  readonly provenanceKind?: "metadataUrl";
};

/** Boundary that resolves exact archive bytes or an out-of-band directory. */
export interface VerificationSourceProvider {
  /** Resolves one bounded source without extracting it. */
  resolve(
    input: VerificationSourceProviderInput,
  ): Promise<ResolvedVerificationSource>;
}

/** One bounded response returned by the pinned-address HTTP transport. */
export type SourceHttpResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly bytes: Uint8Array;
};

/** Input passed to a DNS-pinned source HTTP transport. */
export type SourceHttpTransportInput = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly approvedAddresses: readonly string[];
  readonly timeoutMs: number;
  readonly maxBytes: number;
};

/** Transport boundary that must connect only to policy-approved addresses. */
export interface SourceHttpTransport {
  /** Executes one request without automatically following redirects. */
  request(input: SourceHttpTransportInput): Promise<SourceHttpResponse>;
}

/** DNS boundary used before source-policy evaluation. */
export interface SourceAddressResolver {
  /** Resolves every address eligible for the next pinned request. */
  resolve(hostname: string): Promise<readonly string[]>;
}

/** Options used by the default HTTP source provider. */
export type HttpVerificationSourceProviderOptions = {
  readonly policy: SourceRetrievalPolicy;
  readonly transport?: SourceHttpTransport;
  readonly addressResolver?: SourceAddressResolver;
  readonly headers?: Readonly<Record<string, string>>;
};

/** Host-side credentials used by the GitHub source provider only. */
export type GitHubSourceCredentials = {
  readonly token?: string;
};
