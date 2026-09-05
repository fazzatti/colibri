/**
 * Ledger Streamer Factory - Creates a pre-configured RPCStreamer for Stellar ledgers.
 *
 * @module
 */

import type { Ledger, Server } from "@/native-types.ts";
import { isDefined, Ledger as CoreLedger } from "@colibri/core";
import { RPCStreamer } from "@/streamer.ts";
import type {
  ArchiveIngestContext,
  DataHandler,
  LiveIngestContext,
  LiveIngestionResult,
} from "@/types.ts";
import {
  archiveErrorAllowsSkipping,
  completeArchiveLedger,
  waitForStream,
} from "@/lifecycle.ts";
import type { LedgerStreamerConfig } from "@/variants/ledger/types.ts";

/**
 * Creates the live ingestion function for ledgers.
 *
 * Fetches a single ledger at a time from the live RPC.
 */
function createLiveIngestor() {
  return async function ingestLiveLedger(
    rpc: Server,
    ledgerSequence: number,
    onLedger: DataHandler<Ledger>,
    stopLedger?: number,
    context?: LiveIngestContext,
  ): Promise<LiveIngestionResult> {
    // Fetch single ledger
    const response = await rpc.getLedgers({
      startLedger: ledgerSequence,
      pagination: { limit: 1 },
    });

    if (!response.ledgers || response.ledgers.length === 0) {
      // Ledger not available yet, wait
      return {
        nextLedger: ledgerSequence,
        shouldWait: true,
        hitStopLedger: false,
      };
    }

    const ledgerEntry = response.ledgers[0];
    if (context && !context.isRunning()) {
      return {
        nextLedger: ledgerSequence,
        shouldWait: false,
        hitStopLedger: false,
      };
    }
    const ledger = CoreLedger.fromEntry(ledgerEntry);

    // Check if past stop ledger
    if (isDefined(stopLedger) && ledger.sequence > stopLedger) {
      return {
        nextLedger: ledger.sequence,
        shouldWait: false,
        hitStopLedger: true,
      };
    }

    // Process the ledger
    await onLedger(ledger);

    // Move to next ledger
    return {
      nextLedger: ledger.sequence + 1,
      shouldWait: response.latestLedger === ledgerSequence,
      hitStopLedger: false,
    };
  };
}

/**
 * Creates the archive ingestion function for ledgers.
 *
 * Fetches one ledger at a time from the archive RPC with checkpoint and error support.
 */
function createArchiveIngestor(archivalIntervalMs: number) {
  return async function ingestArchiveLedgers(
    rpc: Server,
    startLedger: number,
    stopLedger: number,
    onLedger: DataHandler<Ledger>,
    context: ArchiveIngestContext,
  ): Promise<number> {
    let currentLedger = startLedger;

    while (context.isRunning() && currentLedger <= stopLedger) {
      try {
        const response = await rpc.getLedgers({
          startLedger: currentLedger,
          pagination: { limit: 1 },
        });
        if (!context.isRunning()) return currentLedger;

        if (!response.ledgers || response.ledgers.length === 0) {
          // No ledgers found, move to next
          currentLedger++;
          continue;
        }

        const ledgerEntry = response.ledgers[0];

        if (ledgerEntry.sequence > stopLedger) {
          return ledgerEntry.sequence;
        }

        const ledger = CoreLedger.fromEntry(ledgerEntry);
        await onLedger(ledger);

        // The entire ledger was delivered successfully, even when its callback
        // requested shutdown. Persist completion before leaving the loop.
        await completeArchiveLedger(context, ledgerEntry.sequence);

        // Move to next ledger
        currentLedger = ledgerEntry.sequence + 1;

        // Wait between archive fetches
        await waitForStream(archivalIntervalMs, context.signal);
      } catch (error) {
        if (!archiveErrorAllowsSkipping(error, currentLedger, context)) {
          throw error;
        }
        currentLedger++;
      }
    }

    return currentLedger;
  };
}

/**
 * Creates a pre-configured RPCStreamer for Stellar ledgers.
 *
 * The returned streamer handles:
 * - Single ledger fetching for live mode
 * - Single ledger fetching for archive mode with checkpoint support
 * - Seamless archive-to-live transitions
 *
 * @param config - Configuration for the ledger streamer
 * @returns A configured RPCStreamer instance for Ledger objects
 *
 * @example
 * ```typescript
 * import { createLedgerStreamer } from "@colibri/rpc-streamer";
 *
 * const streamer = createLedgerStreamer({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   archiveRpcUrl: "https://archive-rpc.example.com",
 * });
 *
 * await streamer.start(async (ledger) => {
 *   console.log(`Ledger ${ledger.sequence}: ${ledger.transactionCount} txs`);
 * }, { startLedger: 1000000 });
 * ```
 */
export function createLedgerStreamer(
  config: LedgerStreamerConfig,
): RPCStreamer<Ledger> {
  const archivalIntervalMs = config.options?.archivalIntervalMs ?? 500;

  const ingestLive = createLiveIngestor();
  const ingestArchive = createArchiveIngestor(archivalIntervalMs);

  return new RPCStreamer<Ledger>({
    ...config,
    ingestLive,
    ingestArchive,
    options: config.options,
  });
}
