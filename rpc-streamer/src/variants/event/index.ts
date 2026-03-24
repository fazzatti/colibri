/**
 * Event Streamer Factory - Creates a pre-configured RPCStreamer for Stellar events.
 *
 * @module
 */

import type { Server } from "stellar-sdk/rpc";
import {
  Event,
  type EventFilter,
  type EventHandler,
  isDefined,
  parseEventsFromLedgerCloseMeta,
} from "@colibri/core";
import { RPCStreamer } from "@/streamer.ts";
import type {
  ArchiveIngestContext,
  DataHandler,
  LiveIngestionResult,
} from "@/types.ts";
import type { EventStreamerConfig } from "./types.ts";

/**
 * Creates the live ingestion function for events.
 *
 * Handles pagination within a ledger and deduplication of events
 * that may be seen multiple times during live streaming.
 */
function createLiveIngestor(
  filters: EventFilter[],
  limit: number,
  pagingIntervalMs: number,
) {
  // Circular buffer for deduplication (only needed in live mode)
  const recentlyCheckedEventsIds: string[] = [];

  // Convert filters to raw SDK format once
  const rawFilters = filters.map((f) => f.toRawEventFilter());

  return async function ingestLiveEvents(
    rpc: Server,
    ledgerSequence: number,
    onEvent: DataHandler<Event>,
    stopLedger?: number,
  ): Promise<LiveIngestionResult> {
    let cursor: string | undefined;

    while (true) {
      // Fetch events with pagination
      const response = cursor
        ? await rpc.getEvents({ cursor, filters: rawFilters, limit })
        : await rpc.getEvents({
          startLedger: ledgerSequence,
          filters: rawFilters,
          limit,
        });

      // Process each event
      for (const eventResponse of response.events) {
        const event = Event.fromEventResponse(eventResponse);

        // Check if this event is past the stop ledger
        if (isDefined(stopLedger) && event.ledger > stopLedger) {
          return {
            nextLedger: event.ledger,
            shouldWait: false,
            hitStopLedger: true,
          };
        }

        // Deduplicate - skip if we've already processed this event
        if (recentlyCheckedEventsIds.includes(event.id)) {
          continue;
        }

        await onEvent(event);

        // Add to circular buffer (max 25 items)
        recentlyCheckedEventsIds.push(event.id);
        if (recentlyCheckedEventsIds.length > 25) {
          recentlyCheckedEventsIds.shift();
        }
      }

      // Check if we need to fetch another page
      if (response.events.length > 0 && response.cursor) {
        cursor = response.cursor;
        await new Promise((resolve) => setTimeout(resolve, pagingIntervalMs));
        continue;
      }

      // No more pages. Check chain state.
      if (response.latestLedger < ledgerSequence) {
        return {
          nextLedger: ledgerSequence,
          shouldWait: true,
          hitStopLedger: false,
        };
      }

      // If we're on the latest ledger, wait for new ledger
      if (response.latestLedger === ledgerSequence) {
        return {
          nextLedger: ledgerSequence + 1,
          shouldWait: true,
          hitStopLedger: false,
        };
      }

      // We're behind, move to next ledger without waiting
      return {
        nextLedger: ledgerSequence + 1,
        shouldWait: false,
        hitStopLedger: false,
      };
    }
  };
}

/**
 * Creates the archive ingestion function for events.
 *
 * Parses events from ledger close metadata XDR. No deduplication needed
 * since we're processing complete ledgers sequentially.
 */
function createArchiveIngestor(
  filters: EventFilter[],
  archivalIntervalMs: number,
) {
  return async function ingestArchiveEvents(
    rpc: Server,
    startLedger: number,
    stopLedger: number,
    onEvent: DataHandler<Event>,
    context: ArchiveIngestContext,
  ): Promise<number> {
    let currentLedger = startLedger;
    const checkpointInterval = context.checkpointInterval ?? 100;

    while (context.isRunning() && currentLedger <= stopLedger) {
      try {
        const ledgerData = await rpc.getLedgers({
          startLedger: currentLedger,
          pagination: { limit: 1 },
        });

        for (const ledger of ledgerData.ledgers) {
          await parseEventsFromLedgerCloseMeta(
            ledger.metadataXdr,
            onEvent as EventHandler,
            filters,
          );
        }

        // Call checkpoint if configured
        if (context.onCheckpoint && currentLedger % checkpointInterval === 0) {
          context.onCheckpoint(currentLedger);
        }

        currentLedger++;
        await new Promise((resolve) => setTimeout(resolve, archivalIntervalMs));
      } catch (error) {
        // Check if error handler wants to continue
        if (context.onError) {
          const shouldContinue = context.onError(error as Error, currentLedger);
          if (shouldContinue !== false) {
            // Error was handled, move to next ledger
            currentLedger++;
            continue;
          }
        }
        // Re-throw if no handler or handler returned false
        throw error;
      }
    }

    return currentLedger;
  };
}

/**
 * Creates a pre-configured RPCStreamer for Stellar events.
 *
 * The returned streamer handles:
 * - Event filtering via the Soroban RPC `getEvents` API
 * - Pagination within ledgers
 * - Deduplication during live streaming
 * - Historical event parsing from ledger metadata
 *
 * @param config - Configuration for the event streamer
 * @returns A configured RPCStreamer instance for Event objects
 *
 * @example
 * ```typescript
 * import { createEventStreamer } from "@colibri/rpc-streamer";
 * import { EventFilter } from "@colibri/core";
 *
 * const streamer = createEventStreamer({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   filters: [new EventFilter({ contractId: "C..." })],
 * });
 *
 * await streamer.start(async (event) => {
 *   console.log("Event:", event.id);
 * }, { startLedger: 1000000 });
 * ```
 */
export function createEventStreamer(
  config: EventStreamerConfig,
): RPCStreamer<Event> {
  const filters = config.filters ?? [];
  const limit = config.options?.limit ?? 10;
  const pagingIntervalMs = config.options?.pagingIntervalMs ?? 100;
  const archivalIntervalMs = config.options?.archivalIntervalMs ?? 500;

  const ingestLive = createLiveIngestor(filters, limit, pagingIntervalMs);
  const ingestArchive = createArchiveIngestor(filters, archivalIntervalMs);

  return new RPCStreamer<Event>({
    rpcUrl: config.rpcUrl,
    allowHttp: config.allowHttp,
    archiveRpcUrl: config.archiveRpcUrl,
    archiveAllowHttp: config.archiveAllowHttp,
    ingestLive,
    ingestArchive,
    options: config.options,
  });
}
