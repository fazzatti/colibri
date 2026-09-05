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
  return {
    ...config,
    ingestLive: createLiveItemIngestor(operationRecords),
    ingestArchive: createArchiveItemIngestor(
      operationRecords,
      config.options?.archivalIntervalMs ?? 500,
    ),
  };
}
