/** Native operation streaming records and configuration. @module */
import type {
  NativeOperation as CoreNativeOperation,
  Operation as CoreOperation,
} from "@colibri/core";
import type {
  StreamedTransaction,
  TransactionStreamerConfig,
} from "@/variants/transaction/types.ts";

/** @internal Exact native SDK operation record, discriminated by `type`. */
export type NativeOperation = CoreNativeOperation;
/** @internal Exact Core parsed operation, retaining parent transaction access. */
export type ParsedOperation = CoreOperation;

/** Operation intent plus execution context; failed transactions are included. */
export interface StreamedOperation extends StreamedTransaction {
  /** Zero-based operation index within the inner transaction for fee bumps. */
  operationIndex: number;
  /** Native SDK record: amounts use SDK decimal-string units. */
  operation: NativeOperation;
  /** Core parser view with the original parent transaction. */
  parsedOperation: ParsedOperation;
}

/** Same connections, pacing and ledger bounds as the transaction variant. */
export type OperationStreamerConfig = TransactionStreamerConfig;
