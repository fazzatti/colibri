import type { Server } from "stellar-sdk/rpc";

import type { BeltPlugin } from "convee";
import type { ColibriError } from "../../mod.ts";
import type { BaseFee } from "../../common/types/transaction-config/types.ts";
import type { Memo, Transaction, xdr } from "stellar-sdk";
import type { Ed25519PublicKey } from "../../strkeys/types.ts";

export type BuildTransactionInput = {
  operations: xdr.Operation[];
  source: Ed25519PublicKey;
  baseFee: BaseFee;
  networkPassphrase: string;
  sorobanData?: string | xdr.SorobanTransactionData;
  memo?: Memo;
  preconditions?: TransactionPreconditions;
} & (WithRpc | WithoutRpc);

export type BuildTransactionOutput = Transaction;

export type BuildTransactionPlugin = BeltPlugin<
  BuildTransactionInput,
  BuildTransactionOutput,
  ColibriError
>;

export type RpcVariants =
  | { rpc?: never; sequence?: never }
  | WithRpc
  | WithoutRpc;

export type WithRpc = {
  rpc: Server;
  sequence?: never;
};
export type WithoutRpc = {
  rpc?: never;
  sequence: string;
};

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
export type LedgerBounds = {
  minLedger?: number;
  maxLedger?: number; // maxLedger can be 0
};

// a window in unix seconds, minTime inclusive, maxTime inclusive,
// 0 means open, builder needs both set or you use setTimeout which
// fills maxTime, validity fails as too early or too late outside
// this window.
export type TimeBounds = {
  // unix seconds, maxTime can be 0
  minTime?: Date | number;
  maxTime?: Date | number;
};

// sets maxTime, minTime=0
// The stellar-sdk uses 0 as infinite.
export type Timeout = number;

// Merge the two types below so you don't
// have conflicting timebounds. They affect
// the same fields in the transaction preconditions.
type TimeBasedPreconditions =
  | { timeBounds?: never; timeoutSeconds?: never }
  | { timeoutSeconds: Timeout; timeBounds?: never }
  | { timeBounds: TimeBounds; timeoutSeconds?: never };

export const NO_LIMIT = 0; // 0 means no limit
