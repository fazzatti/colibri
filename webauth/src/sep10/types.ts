import type { Keypair, Transaction } from "stellar-sdk";
import type { WebAuthCoreSigner, WebAuthSubmissionFormat } from "@/types.ts";

/** Inputs used by the pure SEP-10 challenge verifier. */
export interface VerifySep10ChallengeInput {
  /** Base64 transaction-envelope XDR. */
  transactionXdr: string;
  /** Authoritative network passphrase. */
  networkPassphrase: string;
  /** Discovered server signing key. */
  serverAccount: string;
  /** Requested G or M account. */
  account: string;
  /** Requested ID memo. */
  memo?: string;
  /** Trusted home domain. */
  homeDomain: string;
  /** Expected domain of the WebAuth endpoint. */
  webAuthDomain: string;
  /** Client domain requested by the caller. */
  clientDomain?: string;
  /** Signing key discovered for an accepted client domain. */
  clientDomainAccount?: string;
  /** Injectable Unix time used only by deterministic tests. */
  now?: number;
}

/** Parsed output of the pure SEP-10 challenge verifier. */
export interface VerifiedSep10Challenge {
  /** Parsed challenge transaction. */
  transaction: Transaction;
  /** Original transaction-envelope XDR. */
  transactionXdr: string;
  /** Account bound by the challenge. */
  account: string;
  /** Optional ID memo bound by the challenge. */
  memo?: string;
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
  /** Inclusive minimum Unix time. */
  minTime: number;
  /** Inclusive maximum Unix time. */
  maxTime: number;
}

/** Options accepted by SEP-10 challenge retrieval. */
export interface Sep10GetChallengeOptions {
  /** G or M account being authenticated. */
  account: string;
  /** Optional ID memo for a G account. */
  memo?: string;
  /** Optional client domain. */
  clientDomain?: string;
}

/** Options accepted by the SEP-10 full flow. */
export interface Sep10AuthenticateOptions extends Sep10GetChallengeOptions {
  /** Account signer or signer set. */
  signer:
    | Keypair
    | WebAuthCoreSigner
    | Array<Keypair | WebAuthCoreSigner>;
  /** Signer for an accepted client-domain operation. */
  clientDomainSigner?: Keypair | WebAuthCoreSigner;
}

/** Direct SEP-10 protocol-client construction. */
export interface Sep10ClientConfig {
  /** SEP-10 endpoint. */
  endpoint: string;
  /** Server signing account. */
  serverAccount: string;
  /** Trusted home domain. */
  homeDomain: string;
  /** Domain hosting the SEP-10 endpoint. */
  webAuthDomain: string;
  /** Authoritative Stellar network passphrase. */
  networkPassphrase: string;
  /** Fetch implementation used for client-domain discovery. */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds. @default 30000 */
  timeout?: number;
  /** Permit HTTP for local development. */
  allowHttp?: boolean;
  /** Challenge submission encoding. */
  submissionFormat?: WebAuthSubmissionFormat;
}
