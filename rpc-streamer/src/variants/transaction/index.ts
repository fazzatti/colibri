/** Transaction streaming through native RPC ledger ingestion. @module */
import { RPCStreamer } from "@/streamer.ts";
import { transactionStreamerConfig } from "@/variants/transaction/config.ts";
import type {
  StreamedTransaction,
  TransactionStreamerConfig,
} from "@/variants/transaction/types.ts";

/**
 * Streams every transaction, including failures, in ledger processing order.
 * Cancelling mid-ledger leaves that ledger unacknowledged for replay on resume.
 */
export function createTransactionStreamer(
  config: TransactionStreamerConfig,
): RPCStreamer<StreamedTransaction> {
  return new RPCStreamer(transactionStreamerConfig(config));
}
