import type {
  FeeBumpTransaction as NativeFeeBumpTransaction,
  Transaction as NativeTransaction,
} from "stellar-sdk";
import type { LedgerEntriesConstructorArgs as CoreLedgerEntriesConstructorArgs } from "@colibri/core";

/** @internal Exact native SDK type, retained for JSR declaration generation. */
export type Transaction = NativeTransaction;
/** @internal Exact native SDK type, retained for JSR declaration generation. */
export type FeeBumpTransaction = NativeFeeBumpTransaction;
/** @internal Exact Core connection union, retained for JSR declaration generation. */
export type LedgerEntriesConstructorArgs = CoreLedgerEntriesConstructorArgs;

/** A native transaction and either a Colibri network configuration or RPC client. */
export type CheckMemoRequiredInput = {
  /** Checks the inner transaction when given a fee-bump envelope. Never mutated. */
  transaction: Transaction | FeeBumpTransaction;
} & LedgerEntriesConstructorArgs;

/** Stable identifier for the opt-in SEP-29 plugin. */
export const SEP29_PLUGIN_ID = "Sep29Plugin";
/** The memo check runs on input to the existing submission step. */
export const SEP29_PLUGIN_TARGET = "send-transaction";
/** SEP-29 account-data name; the enabling value is the single ASCII byte 49. */
export const SEP29_MEMO_REQUIRED_DATA_NAME = "config.memo_required";
