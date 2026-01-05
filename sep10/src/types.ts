/**
 * SEP-10 Challenge Types
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

import type { Transaction } from "stellar-sdk";
import type { Buffer } from "buffer";

/**
 * A ManageData operation extracted from a SEP-10 challenge transaction.
 */
export interface ChallengeOperation {
  /** The operation type (always "manageData" for valid challenges) */
  type: "manageData";
  /** The source account for this operation */
  sourceAccount: string;
  /** The data entry key */
  key: string;
  /** The data entry value (base64 encoded in XDR) */
  value: Buffer;
}

/**
 * Time bounds for a SEP-10 challenge transaction.
 */
export interface ChallengeTimeBounds {
  /** Minimum valid time (challenge not valid before this) */
  minTime: Date;
  /** Maximum valid time (challenge expires after this) */
  maxTime: Date;
}

/**
 * Options for building a SEP-10 challenge transaction.
 * Used primarily for server-side challenge generation or testing.
 */
export interface BuildChallengeOptions {
  /** The server's Stellar account (G...) */
  serverAccount: string;
  /** The client's Stellar account (G... or M...) */
  clientAccount: string;
  /** The home domain for the `<domain> auth` key */
  homeDomain: string;
  /** The network passphrase */
  networkPassphrase: string;
  /** The web auth domain (server's domain) */
  webAuthDomain?: string;
  /** Optional client domain for client domain verification */
  clientDomain?: string;
  /** Optional client domain account (required if clientDomain is set) */
  clientDomainAccount?: string;
  /** Optional memo (id type only, for shared accounts) */
  memo?: string;
  /** Challenge timeout in seconds (default: 900 = 15 minutes) */
  timeout?: number;
  /** Custom nonce (48 bytes, will be base64 encoded to 64 bytes). Random if not provided. */
  nonce?: Buffer;
}

/**
 * Options for verifying a SEP-10 challenge.
 */
export interface VerifyChallengeOptions {
  /**
   * The expected home domain. If provided, validates that the challenge's
   * home domain matches.
   */
  homeDomain?: string;
  /**
   * The expected web auth domain. If provided, validates that the challenge's
   * web_auth_domain operation matches.
   */
  webAuthDomain?: string;
  /**
   * Whether to allow challenges that have expired.
   * Default: false
   */
  allowExpired?: boolean;
  /**
   * The current time to use for time bounds validation.
   * Default: new Date()
   */
  now?: Date;
}

/**
 * Result of parsing a SEP-10 challenge transaction.
 */
export interface ParsedChallenge {
  /** The underlying Stellar transaction */
  transaction: Transaction;
  /** The network passphrase used */
  networkPassphrase: string;
  /** The server's account (transaction source) */
  serverAccount: string;
  /** The client's account (first operation source) */
  clientAccount: string;
  /** The home domain extracted from the first operation key */
  homeDomain: string;
  /** The nonce value from the first operation */
  nonce: Buffer;
  /** The web auth domain if present */
  webAuthDomain?: string;
  /** The client domain if present */
  clientDomain?: string;
  /** The client domain account if client_domain operation is present */
  clientDomainAccount?: string;
  /** The memo if present (as string) */
  memo?: string;
  /** The time bounds */
  timeBounds: ChallengeTimeBounds;
  /** All ManageData operations in the challenge */
  operations: ChallengeOperation[];
}

/**
 * A signer function that can sign a transaction hash.
 * Used for custom signing implementations (hardware wallets, etc.)
 */
export type SignerFn = (hash: Buffer) => Promise<Buffer>;

// Re-export client types for convenience
export type {
  Sep10ClientConfig,
  GetChallengeOptions,
  AuthenticateOptions,
} from "@/client/client.ts";
