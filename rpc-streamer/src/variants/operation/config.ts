import { createLedgerParser } from "@/variants/ledger/parser.ts";
import type { RPCStreamerConfig } from "@/types.ts";
import { operationRecords } from "@/variants/operation/records.ts";
import {
  createArchiveItemIngestor,
  createLiveItemIngestor,
} from "@/variants/transaction/ledger-items.ts";
import type {
  OperationStreamerConfig,
  StreamedOperation,
} from "@/variants/operation/types.ts";

/** Builds variant ingestion without importing the engine, avoiding a factory cycle. @internal */
export function operationStreamerConfig(
  config: OperationStreamerConfig,
): RPCStreamerConfig<StreamedOperation> {
  const parseLedger = createLedgerParser(config.networkConfig);
  return {
    ...config,
    ingestLive: createLiveItemIngestor(operationRecords, parseLedger),
    ingestArchive: createArchiveItemIngestor(
      operationRecords,
      config.options?.archivalIntervalMs ?? 500,
      parseLedger,
    ),
  };
}
