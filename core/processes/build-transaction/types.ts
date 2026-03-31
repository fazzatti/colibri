import type { Server } from "stellar-sdk/rpc";
import type { Memo, Transaction, xdr } from "stellar-sdk";
import type { BaseFee } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

/**
 * Input accepted by the build-transaction process.
 */
/** @internal */
export type BuildTransactionInput = {
  /** Operations that will be added to the transaction envelope. */
  operations: xdr.Operation[];
  /** Source account for the transaction. */
  source: Ed25519PublicKey;
  /** Base fee in stroops. */
  baseFee: BaseFee;
  /** Stellar network passphrase. */
  networkPassphrase: string;
  /** Optional Soroban data or encoded Soroban data payload. */
  sorobanData?: string | xdr.SorobanTransactionData;
  /** Optional memo attached to the transaction. */
  memo?: Memo;
  /** Optional transaction preconditions. */
  preconditions?: TransactionPreconditions;
} & (WithRpc | WithoutRpc);

/**
 * Output returned by the build-transaction process.
 */
/** @internal */
export type BuildTransactionOutput = Transaction;

/**
 * Supported RPC and sequence-number input variants accepted by the builder.
 */
/** @internal */
export type RpcVariants =
  | { rpc?: never; sequence?: never }
  | WithRpc
  | WithoutRpc;

/**
 * Build-transaction input variant that loads sequence data from RPC.
 */
/** @internal */
export type WithRpc = {
  rpc: Server;
  sequence?: never;
};

/**
 * Build-transaction input variant that provides the sequence directly.
 */
/** @internal */
export type WithoutRpc = {
  rpc?: never;
  sequence: string;
};

/**
 * Preconditions supported by the build-transaction process.
 */
/** @internal */
export type TransactionPreconditions = {
  ledgerBounds?: LedgerBounds;

  // instead of requiring source seq to be exactly tx.seqNum minus 1,
  // you open a window. The tx is valid when the current seq n satisfies
  // minAccountSequence ≤ n < tx.seqNum. On success the account jumps
  // to tx.seqNum, so no replay. If the window is not met you get txBAD_SEQ.
  // This lets you pre sign with gaps or run parallel queues.
  minAccountSequence?: string; // bigint as string

  // relative timelock in seconds. It becomes valid only after ledger
  // time is at least minAccountSequenceAge seconds past the account’s
  // last seq change. That timestamp is recorded as seqTime whenever the
  // account’s seq changes or you run BumpSequence. If this or the ledger
  // gap below is not met you get txBAD_MIN_SEQ_AGE_OR_GAP.
  minAccountSequenceAge?: number; // seconds

  // same idea, but measured in ledgers, not seconds. It becomes valid only
  // once the current ledger number is at least seqLedger plus the gap.
  // seqLedger updates when the account’s seq changes or on BumpSequence.
  minAccountSequenceLedgerGap?: number; // ledgers

  // These are extra signer requirements for the transaction

  // Up to 2 SignerKeys live in preconditions, each must be satisfied
  // at validation. ed25519 requires a standard signature and uses one
  // slot. HASH_X requires a preimage signature and uses one slot.
  // PREAUTH_TX is satisfied by the transaction hash, no signature slot
  // needed. Duplicates are malformed. Missing any required extra signer
  // results in txBAD_AUTH.
  //
  // These are NOT signatures being added Actual signatures are carried
  // in the transaction envelope, up to 20 total.
  extraSigners?: string[]; // up to 2 extra signers allowed
} & TimeBasedPreconditions;

// a window in ledger sequence, minLedger inclusive, maxLedger exclusive,
// 0 means no upper limit, it combines with timeBounds and everything else
// using AND, so all windows must be true at the same time.
/**
 * Inclusive/exclusive ledger window used by transaction preconditions.
 */
/** @internal */
export type LedgerBounds = {
  minLedger?: number;
  maxLedger?: number; // maxLedger can be 0
};

// a window in unix seconds, minTime inclusive, maxTime inclusive,
// 0 means open, builder needs both set or you use setTimeout which
// fills maxTime, validity fails as too early or too late outside
// this window.
/**
 * Time window used by transaction preconditions.
 */
/** @internal */
export type TimeBounds = {
  // unix seconds, maxTime can be 0
  minTime?: Date | number;
  maxTime?: Date | number;
};

// sets maxTime, minTime=0
// The stellar-sdk uses 0 as infinite.
/**
 * Relative timeout, in seconds, used to derive transaction time bounds.
 */
/** @internal */
export type Timeout = number;

// Merge the two types below so you don't
// have conflicting timebounds. They affect
// the same fields in the transaction preconditions.
type TimeBasedPreconditions =
  | { timeBounds?: never; timeoutSeconds?: never }
  | { timeoutSeconds: Timeout; timeBounds?: never }
  | { timeBounds: TimeBounds; timeoutSeconds?: never };

/**
 * Sentinel value meaning “no upper bound”.
 */
export const NO_LIMIT = 0; // 0 means no limit
