/** Transaction streaming records and configuration. @module */
import type { Transaction as CoreTransaction } from "@colibri/core";
import type { LedgerStreamerConfig } from "@/variants/ledger/types.ts";

/** @internal Exact parsed Core transaction; no replacement envelope or operation types. */
export type ParsedTransaction = CoreTransaction;

/** Transaction record with its completed-ledger context. */
export interface StreamedTransaction {
  /** Containing ledger sequence. */
  ledgerSequence: number;
  /** Containing ledger hash. */
  ledgerHash: string;
  /** Ledger close timestamp, in seconds as returned by RPC. */
  ledgerCloseTime: string;
  /** Network transaction hash from the transaction result pair. */
  transactionHash: string;
  /** Zero-based transaction index in the ledger's processing list. */
  transactionIndex: number;
  /** Includes failed transactions; a success filter is never implicit. */
  transactionStatus: "success" | "failed";
  /** Parsed transaction with native ledger result-code and operation access. */
  transaction: ParsedTransaction;
}

/** Uses the same live/archive connections and pacing as ledger streaming. */
export type TransactionStreamerConfig = LedgerStreamerConfig;
