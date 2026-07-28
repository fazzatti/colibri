import type { INetworkConfig, Signer } from "@colibri/core";
import type { ContractAuthHandler } from "@/sep45/contract-auth.ts";
import type {
  Keypair,
  SorobanAuthorizationEntry,
} from "@/stellar-sdk-types.ts";

/** @internal Exact Core network shape retained without re-exporting Core. */
export type WebAuthCoreNetworkConfig = INetworkConfig;

/** @internal Exact Core signer shape retained without re-exporting Core. */
export type WebAuthCoreSigner = Signer;

/** WebAuth protocols implemented by Colibri. */
export type WebAuthProtocol = "sep10" | "sep45";

/** Supported POST body encodings for challenge submission. */
export type WebAuthSubmissionFormat = "json" | "form";

/** Shared construction options for discovered clients. */
export interface WebAuthConstructionOptions {
  /** Authoritative Stellar network configuration. */
  network: WebAuthCoreNetworkConfig;
  /** Optional fetch implementation. */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds. @default 30000 */
  timeout?: number;
  /** Challenge submission body encoding. @default "json" */
  submissionFormat?: WebAuthSubmissionFormat;
  /** Permit HTTP endpoints for local development. */
  allowHttp?: boolean;
}

/** Direct WebAuth client construction. */
export interface WebAuthClientConfig extends WebAuthConstructionOptions {
  /** Home domain to which every challenge is bound. */
  homeDomain: string;
  /** Server signing key advertised by the home domain. */
  signingKey: string;
  /** SEP-10 configuration, when supported. */
  sep10?: { endpoint: string };
  /** SEP-45 configuration, when supported. */
  sep45?: { endpoint: string; contractId: string };
}

/** SEP-10 authentication options. */
export interface Sep10AuthenticationOptions {
  /** G or M account to authenticate. */
  account: string;
  /** Signer or signer set for the account. */
  signer:
    | Keypair
    | WebAuthCoreSigner
    | Array<Keypair | WebAuthCoreSigner>;
  /** Optional ID memo, allowed only for G accounts. */
  memo?: string;
  /** Optional client domain. */
  clientDomain?: string;
  /** Signer for the accepted client-domain operation. */
  clientDomainSigner?: Keypair | WebAuthCoreSigner;
}

/** SEP-45 authentication options. */
export interface Sep45AuthenticationOptions {
  /** C account to authenticate. */
  account: string;
  /** Application-defined full-entry authorization handler. */
  authorize: ContractAuthHandler;
  /**
   * Number of ledgers for which client-controlled entries remain valid.
   *
   * @default 6
   *
   * Six ledgers is approximately 30 seconds at a typical five-second ledger
   * cadence. Ledger close times vary, and the server entry remains the hard
   * upper bound.
   */
  authorizationValidityLedgers?: number;
  /** Optional client domain. */
  clientDomain?: string;
  /** Signer for an accepted client-domain entry. */
  clientDomainSigner?: Keypair | WebAuthCoreSigner;
}

/** Runtime-discriminated automatic authentication input. */
export type WebAuthAuthenticationOptions =
  | Sep10AuthenticationOptions
  | Sep45AuthenticationOptions;

/** Context passed to a contract authorization handler. */
export interface ContractAuthContext {
  /** Authoritative network passphrase. */
  networkPassphrase: string;
  /** Absolute expiration selected by the SEP-45 client. */
  validUntilLedgerSeq: number;
}

/** Full-entry contract authorization hook. */
export type ContractAuthorizationResult =
  | SorobanAuthorizationEntry
  | Promise<SorobanAuthorizationEntry>;
