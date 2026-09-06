import {
  createLedgerParser,
  type LedgerParser,
} from "@/variants/ledger/parser.ts";
import type { Ledger } from "@/native-types.ts";
import type {
  ArchiveIngestContext,
  ArchiveIngestFunc,
  DataHandler,
  LiveIngestContext,
  LiveIngestFunc,
} from "@/types.ts";
import {
  archiveErrorAllowsSkipping,
  completeArchiveLedger,
  waitForStream,
} from "@/lifecycle.ts";

/** Converts one whole ledger to its ordered stream items. @internal */
export type LedgerItems<T> = (ledger: Ledger) => T[];

/**
 * Returns false when delivery stops before the final item. Stopping in the final
 * callback still acknowledges completion. Failed callbacks never acknowledge it.
 * @internal
 */
export async function deliverLedgerItems<T>(
  items: T[],
  onData: DataHandler<T>,
  context?: LiveIngestContext,
): Promise<boolean> {
  for (const item of items) {
    if (context && !context.isRunning()) return false;
    await onData(item);
  }
  return true;
}

/** Live getLedgers ingestion shared by transaction and operation variants. @internal */
export function createLiveItemIngestor<T>(
  select: LedgerItems<T>,
  parseLedger: LedgerParser = createLedgerParser(),
): LiveIngestFunc<T> {
  return async (rpc, sequence, onData, stopLedger, context) => {
    const response = await rpc.getLedgers({
      startLedger: sequence,
      pagination: { limit: 1 },
    });
    const entry = response.ledgers[0];
    if (!entry) {
      return { nextLedger: sequence, shouldWait: true, hitStopLedger: false };
    }
    if (stopLedger !== undefined && entry.sequence > stopLedger) {
      return { nextLedger: sequence, shouldWait: false, hitStopLedger: true };
    }
    if (context && !context.isRunning()) {
      return { nextLedger: sequence, shouldWait: false, hitStopLedger: false };
    }
    const ledger = await parseLedger(rpc, entry);
    const complete = await deliverLedgerItems(
      select(ledger),
      onData,
      context,
    );
    return {
      nextLedger: complete ? entry.sequence + 1 : sequence,
      shouldWait: response.latestLedger === entry.sequence,
      hitStopLedger: false,
    };
  };
}

/** Fetches and acknowledges a single archive ledger only after all items. @internal */
async function ingestArchiveItemLedger<T>(
  rpc: Parameters<ArchiveIngestFunc<T>>[0],
  sequence: number,
  stopLedger: number,
  select: LedgerItems<T>,
  onData: DataHandler<T>,
  context: ArchiveIngestContext,
  parseLedger: LedgerParser,
): Promise<number> {
  const response = await rpc.getLedgers({
    startLedger: sequence,
    pagination: { limit: 1 },
  });
  if (!context.isRunning()) return sequence;
  const entry = response.ledgers[0];
  if (!entry) return sequence + 1;
  if (entry.sequence > stopLedger) return entry.sequence;
  const ledger = await parseLedger(rpc, entry);
  const complete = await deliverLedgerItems(
    select(ledger),
    onData,
    context,
  );
  if (!complete) return sequence;
  await completeArchiveLedger(context, entry.sequence);
  return entry.sequence + 1;
}

/** Archive getLedgers ingestion with the existing explicit error-skip policy. @internal */
export function createArchiveItemIngestor<T>(
  select: LedgerItems<T>,
  intervalMs: number,
  parseLedger: LedgerParser = createLedgerParser(),
): ArchiveIngestFunc<T> {
  return async (rpc, start, stop, onData, context) => {
    let sequence = start;
    while (context.isRunning() && sequence <= stop) {
      try {
        sequence = await ingestArchiveItemLedger(
          rpc,
          sequence,
          stop,
          select,
          onData,
          context,
          parseLedger,
        );
        await waitForStream(intervalMs, context.signal);
      } catch (error) {
        if (!archiveErrorAllowsSkipping(error, sequence, context)) throw error;
        sequence++;
      }
    }
    return sequence;
  };
}
