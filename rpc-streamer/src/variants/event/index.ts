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
import type { EventStreamerConfig } from "@/variants/event/types.ts";

/**
 * Creates the live ingestion function for events.
 *
 * Fully drains one ledger before advancing. Cursor requests cannot carry an
 * endLedger, so their events are also checked against the same ledger boundary.
 */
function createLiveIngestor(
  filters: EventFilter[],
  limit: number,
  pagingIntervalMs: number,
  isRunning: () => boolean,
) {
  // Convert filters to raw SDK format once
  const rawFilters = filters.map((f) => f.toRawEventFilter());

  return async function ingestLiveEvents(
    rpc: Server,
    ledgerSequence: number,
    onEvent: DataHandler<Event>,
    stopLedger?: number,
  ): Promise<LiveIngestionResult> {
    let cursor: string | undefined;
    // No fixed-size eviction: every delivered ID in this ledger remains known
    // until all of its pages have been consumed. A new run starts independently.
    const checkedIds = new Set<string>();

    while (true) {
      // Fetch events with pagination
      const response = cursor
        ? await rpc.getEvents({ cursor, filters: rawFilters, limit })
        : await rpc.getEvents({
          startLedger: ledgerSequence,
          endLedger: ledgerSequence + 1,
          filters: rawFilters,
          limit,
        });

      // Process each event
      for (const eventResponse of response.events) {
        if (!isRunning()) {
          return {
            nextLedger: ledgerSequence,
            shouldWait: false,
            hitStopLedger: false,
          };
        }
        const event = Event.fromEventResponse(eventResponse);

        // Cursor pagination may include later ledgers. Leave them for their own
        // iteration instead of delivering them now and then replaying them.
        if (event.ledger > ledgerSequence) {
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: isDefined(stopLedger) &&
              ledgerSequence >= stopLedger,
          };
        }

        // Deduplicate - skip if we've already processed this event
        if (event.ledger < ledgerSequence || checkedIds.has(event.id)) {
          continue;
        }

        await onEvent(event);

        checkedIds.add(event.id);
      }

      if (!isRunning()) {
        return {
          nextLedger: ledgerSequence,
          shouldWait: false,
          hitStopLedger: false,
        };
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
 *   filters: [new EventFilter({ contractIds: ["C..."] })],
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

  const ingestLive = createLiveIngestor(
    filters,
    limit,
    pagingIntervalMs,
    () => streamer.isRunning,
  );
  const ingestArchive = createArchiveIngestor(filters, archivalIntervalMs);

  const streamer = new RPCStreamer<Event>({
    rpcUrl: config.rpcUrl,
    allowHttp: config.allowHttp,
    archiveRpcUrl: config.archiveRpcUrl,
    archiveAllowHttp: config.archiveAllowHttp,
    ingestLive,
    ingestArchive,
    options: config.options,
  });
  return streamer;
}
