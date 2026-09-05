import type { ArchiveIngestContext } from "@/types.ts";
import { RPCStreamerError, RPCStreamerErrorCode } from "@/errors.ts";

/** Preserve the explicit skip policy, except for failed persistence. @internal */
export function archiveErrorAllowsSkipping(
  error: unknown,
  ledger: number,
  context: ArchiveIngestContext,
): boolean {
  if (
    error instanceof RPCStreamerError &&
    error.code === RPCStreamerErrorCode.CHECKPOINT_FAILED
  ) return false;
  return context.onError
    ? context.onError(error as Error, ledger) !== false
    : false;
}

/** Cooperative timer cancellation without abandoning an in-flight RPC request. @internal */
export function waitForStream(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal?.addEventListener("abort", finish, { once: true });
  });
}

/** Completes only fully consumed ledgers, including awaited persistence. @internal */
export async function completeArchiveLedger(
  context: ArchiveIngestContext,
  ledger: number,
): Promise<void> {
  if (context.onLedgerComplete) {
    await context.onLedgerComplete(ledger);
  } else if (
    context.onCheckpoint && ledger % (context.checkpointInterval ?? 100) === 0
  ) {
    await context.onCheckpoint(ledger);
  }
}
