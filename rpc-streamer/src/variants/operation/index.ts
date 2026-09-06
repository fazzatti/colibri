/** Operation streaming over the existing RPC getLedgers interface. @module */
import { RPCStreamer } from "@/streamer.ts";
import { operationStreamerConfig } from "@/variants/operation/config.ts";
import type {
  OperationStreamerConfig,
  StreamedOperation,
} from "@/variants/operation/types.ts";

/**
 * Streams SDK-discriminated operation records with parent transaction status.
 * Ledger checkpoints occur only after every operation callback completes.
 * A payment in a failed transaction is intent, not a completed payment.
 */
export function createOperationStreamer(
  config: OperationStreamerConfig,
): RPCStreamer<StreamedOperation> {
  return new RPCStreamer(operationStreamerConfig(config));
}
