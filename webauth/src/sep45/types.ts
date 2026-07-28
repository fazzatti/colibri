import type { Keypair, Transaction, xdr } from "stellar-sdk";
import type { WebAuthCoreSigner, WebAuthSubmissionFormat } from "@/types.ts";
import type { ContractAuthHandler } from "@/sep45/contract-auth.ts";

/** Minimal RPC boundary used by the SEP-45 client. */
export interface Sep45Rpc {
  /** Returns the latest ledger sequence. */
  getLatestLedger(): Promise<{ sequence: number }>;
  /** Simulates a transaction using the selected authorization mode. */
  simulateTransaction(
    transaction: Transaction,
    resourceLeeway?: Parameters<
      import("stellar-sdk/rpc").Server["simulateTransaction"]
    >[1],
    authMode?: "enforce" | "record" | "record_allow_nonroot",
  ): ReturnType<import("stellar-sdk/rpc").Server["simulateTransaction"]>;
}

/** Inputs used by the pure SEP-45 challenge verifier. */
export interface VerifySep45ChallengeInput {
  /** Base64 XDR array of authorization entries. */
  authorizationEntriesXdr: string;
  /** Authoritative Stellar network passphrase. */
  networkPassphrase: string;
  /** WebAuth contract advertised by the home domain. */
  webAuthContractId: string;
  /** Server signing account advertised by the home domain. */
  serverAccount: string;
  /** Requested contract account. */
  account: string;
  /** Trusted home domain. */
  homeDomain: string;
  /** Domain hosting the WebAuth endpoint. */
  webAuthDomain: string;
  /** Optional client domain requested by the caller. */
  clientDomain?: string;
  /** Signing account discovered for the accepted client domain. */
  clientDomainAccount?: string;
  /** Latest known ledger used for expiration checks. */
  latestLedger: number;
}

/** Parsed result of SEP-45 challenge verification. */
export interface VerifiedSep45Challenge {
  /** Original base64 authorization-entry array XDR. */
  authorizationEntriesXdr: string;
  /** Decoded authorization entries. */
  entries: xdr.SorobanAuthorizationEntry[];
  /** Shared WebAuth invocation argument. */
  invocationArgument: xdr.ScVal;
  /** Complete normalized invocation argument map. */
  arguments: Readonly<Record<string, string>>;
  /** Unknown Symbol-to-String arguments preserved by the verifier. */
  extensionArguments: Readonly<Record<string, string>>;
  /** Index of the client account entry. */
  clientEntryIndex: number;
  /** Index of the server account entry. */
  serverEntryIndex: number;
  /** Index of the accepted client-domain entry. */
  clientDomainEntryIndex?: number;
  /** Contract account bound by the challenge. */
  account: string;
  /** Verified server signing account. */
  serverAccount: string;
  /** Verified home domain. */
  homeDomain: string;
  /** Verified web-auth domain. */
  webAuthDomain: string;
  /** Accepted client domain. */
  clientDomain?: string;
  /** Signing account discovered for the client domain. */
  clientDomainAccount?: string;
  /** Absolute expiration of the server entry. */
  serverExpirationLedger: number;
}

/** Options accepted by SEP-45 challenge retrieval. */
export interface Sep45GetChallengeOptions {
  /** Contract account being authenticated. */
  account: string;
  /** Optional client domain. */
  clientDomain?: string;
}

/** Options used while authorizing a verified SEP-45 challenge. */
export interface Sep45AuthorizeChallengeOptions {
  /**
   * Number of ledgers for which client-controlled entries remain valid.
   * @default 6
   */
  authorizationValidityLedgers?: number;
  /** Signer for an accepted client-domain entry. */
  clientDomainSigner?: Keypair | WebAuthCoreSigner;
}

/** Options for the complete SEP-45 flow. */
export interface Sep45AuthenticateOptions
  extends Sep45GetChallengeOptions, Sep45AuthorizeChallengeOptions {
  /** Application-defined full-entry authorization handler. */
  authorize: ContractAuthHandler;
}

/** Direct SEP-45 protocol-client construction. */
export interface Sep45ClientConfig {
  /** SEP-45 endpoint. */
  endpoint: string;
  /** Server signing account. */
  serverAccount: string;
  /** Trusted home domain. */
  homeDomain: string;
  /** Domain hosting the SEP-45 endpoint. */
  webAuthDomain: string;
  /** WebAuth contract advertised by the home domain. */
  webAuthContractId: string;
  /** Authoritative Stellar network passphrase. */
  networkPassphrase: string;
  /** RPC implementation used for ledger and simulation requests. */
  rpc: Sep45Rpc;
  /** Fetch implementation used for client-domain discovery. */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds. @default 30000 */
  timeout?: number;
  /** Permit HTTP for local development. */
  allowHttp?: boolean;
  /** Challenge submission encoding. */
  submissionFormat?: WebAuthSubmissionFormat;
}

/** Receipt proving that enforcing simulation and footprint checks passed. */
export interface Sep45SimulationReceipt {
  /** Latest ledger observed during preparation. */
  latestLedger: number;
  /** Simulated transaction-envelope XDR. */
  transactionXdr: string;
  /** Canonical read-only footprint keys. */
  readOnlyFootprint: readonly string[];
  /** Canonical read-write footprint keys. */
  readWriteFootprint: readonly string[];
}
