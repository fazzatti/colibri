import type { RPCStreamerConfig } from "@/types.ts";
import { transactionRecords } from "@/variants/transaction/records.ts";
import {
  createArchiveItemIngestor,
  createLiveItemIngestor,
} from "@/variants/transaction/ledger-items.ts";
import type {
  StreamedTransaction,
  TransactionStreamerConfig,
} from "@/variants/transaction/types.ts";

/** Builds variant ingestion without importing the engine, avoiding a factory cycle. @internal */
export function transactionStreamerConfig(
  config: TransactionStreamerConfig,
): RPCStreamerConfig<StreamedTransaction> {
  return {
    ...config,
    ingestLive: createLiveItemIngestor(transactionRecords),
    ingestArchive: createArchiveItemIngestor(
      transactionRecords,
      config.options?.archivalIntervalMs ?? 500,
    ),
  };
}
