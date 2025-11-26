import { type Api, Server } from "stellar-sdk/rpc";
import {
  type EventHandler,
  parseEventsFromLedgerCloseMeta,
  isDefined,
  assert,
} from "@colibri/core/";
import type { EventFilters } from "@/types.ts";
import * as E from "@/error.ts";

/**
 * Extended health response type that includes additional fields missing from the SDK.
 * @see https://github.com/stellar/js-stellar-sdk/issues/1289
 */
type GetHealthResponse = Api.GetHealthResponse & {
  /** The most recent ledger available on the RPC */
  latestLedger: number;
  /** The oldest ledger available on the RPC */
  oldestLedger: number;
  /** The number of ledgers retained by the RPC */
  ledgerRetentionWindow: number;
};

/**
 * A streaming client for Stellar blockchain events that supports both live and historical ingestion.
 *
 * The EventStreamer provides three main modes of operation:
 * - **Live mode** (`startLive`): Streams events from the current RPC retention window using `getEvents`
 * - **Archive mode** (`startArchive`): Ingests historical events from an archive RPC using `getLedgers`
 * - **Auto mode** (`start`): Automatically switches between archive and live mode based on ledger availability
 *
 * @example
 * ```typescript
 * const streamer = new EventStreamer({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   archiveRpcUrl: "https://archive-rpc.example.com",
 *   filters: [new EventFilter({ contractId: "C..." })],
 *   options: { waitLedgerIntervalMs: 5000 }
 * });
 *
 * await streamer.start(async (event) => {
 *   console.log("Event received:", event);
 * }, { startLedger: 1000000 });
 * ```
 */
export class EventStreamer {
  /** The main RPC server for live event streaming */
  private _rpc: Server;
  /** Optional archive RPC server for historical ledger ingestion */
  private _archiveRpc: Server | undefined = undefined;
  /** Event filters to apply when fetching events */
  private _filters: EventFilters = [];
  /** Maximum number of events to fetch per request */
  private _limit: number = 10;
  /** Interval to wait between ledger checks in live mode (ms) */
  private _waitLedgerIntervalMs: number = 5000;
  /** Interval to wait between pagination requests (ms) */
  private _pagingIntervalMs: number = 100;
  /** Interval to wait between archive ledger fetches (ms) */
  private _archivalIntervalMs: number = 500;
  /** Whether to skip waiting when catching up to the latest ledger */
  private _skipLedgerWaitIfBehind: boolean = false;
  /** Flag indicating if the streamer is currently running */
  private _isRunning: boolean = false;
  /** Circular buffer of recently processed event IDs for deduplication */
  private _recentlyCheckedEventsIds: string[] = [];

  /**
   * Creates a new EventStreamer instance.
   *
   * @param config - Configuration object for the streamer
   * @param config.rpcUrl - URL of the Soroban RPC server for live event streaming
   * @param config.archiveRpcUrl - Optional URL of an archive RPC server for historical ingestion
   * @param config.filters - Optional array of event filters to apply
   * @param config.options - Optional configuration options
   * @param config.options.limit - Maximum events per request (default: 10)
   * @param config.options.waitLedgerIntervalMs - Interval between ledger checks in ms (default: 5000)
   * @param config.options.pagingIntervalMs - Interval between pagination requests in ms (default: 100)
   * @param config.options.archivalIntervalMs - Interval between archive fetches in ms (default: 500)
   * @param config.options.skipLedgerWaitIfBehind - Skip waiting when catching up (default: false)
   *
   * @throws {PAGING_INTERVAL_TOO_LONG} If pagingIntervalMs exceeds waitLedgerIntervalMs
   *
   * @example
   * ```typescript
   * const streamer = new EventStreamer({
   *   rpcUrl: "https://soroban-testnet.stellar.org",
   *   options: { waitLedgerIntervalMs: 3000 }
   * });
   * ```
   */
  constructor({
    rpcUrl,
    archiveRpcUrl,
    filters,
    options,
  }: {
    rpcUrl: string;
    archiveRpcUrl?: string;
    filters?: EventFilters;
    options?: {
      limit?: number;
      waitLedgerIntervalMs?: number;
      pagingIntervalMs?: number;
      archivalIntervalMs?: number;
      skipLedgerWaitIfBehind?: boolean;
    };
  }) {
    this._rpc = new Server(rpcUrl);
    if (archiveRpcUrl) this._archiveRpc = new Server(archiveRpcUrl);
    if (filters) this._filters = filters;
    if (isDefined(options)) {
      if (isDefined(options.limit)) this._limit = options.limit;
      if (isDefined(options.waitLedgerIntervalMs))
        this._waitLedgerIntervalMs = options.waitLedgerIntervalMs;
      if (isDefined(options.pagingIntervalMs))
        this._pagingIntervalMs = options.pagingIntervalMs;
      if (isDefined(options.archivalIntervalMs))
        this._archivalIntervalMs = options.archivalIntervalMs;
      if (isDefined(options.skipLedgerWaitIfBehind))
        this._skipLedgerWaitIfBehind = options.skipLedgerWaitIfBehind;
    }

    assert(
      this._pagingIntervalMs <= this._waitLedgerIntervalMs,
      new E.PAGING_INTERVAL_TOO_LONG(
        this._waitLedgerIntervalMs,
        this._pagingIntervalMs
      )
    );
  }

  /**
   * Gets the current RPC server instance.
   * @returns The Soroban RPC server used for live streaming
   */
  get rpc(): Server {
    return this._rpc;
  }

  /**
   * Sets the RPC server instance.
   * @param rpc - The new RPC server instance
   * @throws {RPC_ALREADY_SET} If an RPC server is already configured
   */
  set rpc(rpc: Server) {
    assert(!isDefined(this._rpc), new E.RPC_ALREADY_SET());
    this._rpc = rpc;
  }

  /**
   * Gets the current archive RPC server instance.
   * @returns The archive RPC server, or undefined if not configured
   */
  get archiveRpc(): Server | undefined {
    return this._archiveRpc;
  }

  /**
   * Sets the archive RPC server instance.
   * @param archiveRpc - The new archive RPC server instance
   * @throws {ARCHIVE_RPC_ALREADY_SET} If an archive RPC server is already configured
   */
  set archiveRpc(archiveRpc: Server) {
    assert(!isDefined(this._archiveRpc), new E.ARCHIVE_RPC_ALREADY_SET());
    this._archiveRpc = archiveRpc;
  }

  /**
   * Gets the current event filters.
   * @returns Array of event filters applied to streaming
   */
  get filters(): EventFilters {
    return this._filters;
  }

  /**
   * Sets the event filters.
   * @param filters - Array of event filters to apply
   */
  set filters(filters: EventFilters) {
    this.setFilters(filters!);
  }

  /**
   * Sets the event filters for streaming.
   * @param filters - Array of event filters to apply
   */
  public setFilters(filters: EventFilters) {
    this._filters = filters;
  }

  /**
   * Clears all event filters.
   */
  public clearFilters() {
    this._filters = [];
  }

  /**
   * Sets the archive RPC server by URL.
   * @param archiveRpcUrl - URL of the archive RPC server
   */
  public setArchiveRpc(archiveRpcUrl: string) {
    this._archiveRpc = new Server(archiveRpcUrl);
  }

  /**
   * Converts the event filters to raw SDK format.
   * @returns Array of raw event filters for the SDK
   * @internal
   */
  private getRawFilters(): Api.EventFilter[] {
    return this._filters.map((filter) => filter.toRawEventFilter());
  }

  /**
   * Waits for a specified interval type.
   * @param interval - The type of interval to wait for
   * @returns Promise that resolves after the interval
   * @internal
   */
  private waitFor(interval: "paging" | "ledger" | "archival") {
    let intervalMs: number;
    switch (interval) {
      case "paging":
        intervalMs = this._pagingIntervalMs;
        break;
      case "archival":
        intervalMs = this._archivalIntervalMs;
        break;
      case "ledger":
      default:
        intervalMs = this._waitLedgerIntervalMs;
        break;
    }
    return new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  /**
   * Stops the event streaming process.
   *
   * This method sets the internal running flag to false, which will cause
   * any active streaming loop to exit gracefully after completing its
   * current operation.
   *
   * @example
   * ```typescript
   * // Start streaming in background
   * const streamPromise = streamer.start(handleEvent);
   *
   * // Stop after 10 seconds
   * setTimeout(() => streamer.stop(), 10000);
   *
   * await streamPromise; // Will resolve after stop is called
   * ```
   */
  public stop() {
    this._isRunning = false;
  }

  /**
   * Starts live-only ingestion using the standard RPC (getEvents).
   * Will throw if the requested ledger range is outside the RPC retention window.
   * Does NOT auto-switch to historical mode.
   *
   * @param onEvent Callback to process events.
   * @param options Start and stop ledgers.
   */
  public async startLive(
    onEvent: EventHandler,
    options: { startLedger?: number; stopLedger?: number } = {}
  ) {
    assert(!this._isRunning, new E.STREAMER_ALREADY_RUNNING());

    this._isRunning = true;

    try {
      const rpcDetails = (await this._rpc.getHealth()) as GetHealthResponse;

      assert(rpcDetails.status === "healthy", new E.RPC_NOT_HEALTHY());

      let currentLedger = options.startLedger ?? rpcDetails.latestLedger;
      const oldestAvailable = rpcDetails.oldestLedger + 2;

      assert(
        currentLedger >= oldestAvailable,
        new E.LEDGER_TOO_OLD(currentLedger, oldestAvailable)
      );

      assert(
        currentLedger <= rpcDetails.latestLedger,
        new E.LEDGER_TOO_HIGH(currentLedger, rpcDetails.latestLedger)
      );

      while (this._isRunning) {
        // Check if we have passed the stop ledger
        if (
          options.stopLedger !== undefined &&
          currentLedger > options.stopLedger
        ) {
          this.stop();
          break;
        }

        const { nextLedger, shouldWait, hitStopLedger } =
          await this.ingestLiveLedger(
            currentLedger,
            onEvent,
            options.stopLedger
          );

        if (hitStopLedger) {
          this.stop();
          break;
        }

        currentLedger = nextLedger;

        // Don't wait if we're about to stop
        if (
          shouldWait &&
          (options.stopLedger === undefined ||
            currentLedger <= options.stopLedger)
        ) {
          await this.waitFor("ledger");
        }
      }
    } catch (error) {
      this._isRunning = false;
      throw error;
    }
  }

  /**
   * Starts archive-only ingestion using the Archive RPC (getLedgers).
   * Will throw if no archive RPC is configured or if the ledger range is invalid.
   * Does NOT auto-switch to live mode.
   *
   * @param onEvent Callback to process events.
   * @param options Start and stop ledgers (both required for archive).
   */
  public async startArchive(
    onEvent: EventHandler,
    options: { startLedger: number; stopLedger: number }
  ) {
    assert(!this._isRunning, new E.STREAMER_ALREADY_RUNNING());
    assert(isDefined(this._archiveRpc), new E.MISSING_ARCHIVE_RPC());
    assert(
      options.startLedger <= options.stopLedger,
      new E.INVALID_INGESTION_RANGE(options.startLedger, options.stopLedger)
    );

    this._isRunning = true;

    try {
      await this.ingestHistoricalLedger(
        options.startLedger,
        options.stopLedger,
        onEvent
      );
      this.stop();
    } catch (error) {
      this._isRunning = false;
      throw error;
    }
  }

  /**
   * Starts the ingestion process.
   * Routes to historical or live ingestion based on ledger availability.
   * @param onEvent Callback to process events.
   * @param options Optional start and end ledgers.
   */
  public async start(
    onEvent: EventHandler,
    options: { startLedger?: number; stopLedger?: number } = {}
  ) {
    assert(!this._isRunning, new E.STREAMER_ALREADY_RUNNING());

    this._isRunning = true;

    try {
      const rpcDetails = (await this._rpc.getHealth()) as GetHealthResponse;

      assert(rpcDetails.status === "healthy", new E.RPC_NOT_HEALTHY());

      let currentLedger = options.startLedger ?? rpcDetails.latestLedger;

      while (this._isRunning) {
        // Check if we have passed the stop ledger
        if (
          isDefined(options.stopLedger) &&
          currentLedger > options.stopLedger
        ) {
          this.stop();
          break;
        }

        // Refresh RPC health to get current oldest available ledger
        const health = (await this._rpc.getHealth()) as GetHealthResponse;
        const oldestAvailable = health.oldestLedger + 2; // +2 safety buffer

        assert(
          currentLedger <= health.latestLedger,
          new E.LEDGER_TOO_HIGH(currentLedger, health.latestLedger)
        );

        if (currentLedger < oldestAvailable) {
          // Historical mode: requires an archive RPC
          assert(
            isDefined(this._archiveRpc),
            new E.LEDGER_TOO_OLD(currentLedger, oldestAvailable)
          );

          // Determine target: either stopLedger or oldestAvailable-1 (whichever is smaller)
          // We use oldestAvailable-1 because we want to stop just before live mode takes over
          const targetLedger = isDefined(options.stopLedger)
            ? Math.min(oldestAvailable - 1, options.stopLedger)
            : oldestAvailable - 1;

          // Ingest historical ledgers until we reach the target
          currentLedger = await this.ingestHistoricalLedger(
            currentLedger,
            targetLedger,
            onEvent
          );

          // Loop back to re-check (oldestAvailable may have shifted)
          continue;
        }

        // Live mode: use standard RPC with getEvents
        const { nextLedger, shouldWait, hitStopLedger } =
          await this.ingestLiveLedger(
            currentLedger,
            onEvent,
            options.stopLedger
          );

        if (hitStopLedger) {
          this.stop();
          break;
        }

        currentLedger = nextLedger;

        // Don't wait if we're about to stop
        if (
          shouldWait &&
          (!isDefined(options.stopLedger) ||
            currentLedger <= options.stopLedger)
        ) {
          await this.waitFor("ledger");
        }
      }
    } catch (error) {
      this._isRunning = false;
      throw error;
    }
  }

  /**
   * Ingests events from historical ledgers using the Archive RPC.
   * Uses getLedgers() and parses events from raw ledger data.
   *
   * When called directly (not via start()), this method will throw if
   * the ledger range is not available in the archive.
   *
   * @param startLedger The ledger to start ingesting from (inclusive).
   * @param stopLedger The ledger to stop ingesting at (inclusive).
   * @param onEvent Callback to process events.
   * @returns The next ledger to process after finishing the range.
   */
  private async ingestHistoricalLedger(
    startLedger: number,
    stopLedger: number,
    _onEvent: EventHandler
  ): Promise<number> {
    assert(isDefined(this._archiveRpc), new E.MISSING_ARCHIVE_RPC());

    let currentLedger = startLedger;

    while (this._isRunning && currentLedger <= stopLedger) {
      const ledgerData = await this._archiveRpc.getLedgers({
        startLedger: currentLedger,
        pagination: { limit: 1 },
      });

      for (const ledger of ledgerData.ledgers) {
        const metadataXdr = ledger.metadataXdr;

        await parseEventsFromLedgerCloseMeta(
          metadataXdr,
          _onEvent,
          this._filters
        );
      }

      currentLedger++;
      await this.waitFor("archival");
    }

    return currentLedger;
  }

  /**
   * Ingests events for a single ledger using the standard RPC (getEvents).
   * Handles pagination within that ledger.
   * Returns the next ledger sequence and whether we should wait before proceeding.
   *
   * When called directly, this method will NOT auto-switch to historical mode.
   *
   * @param ledgerSequence The ledger to ingest events from.
   * @param onEvent Callback to process events.
   * @param stopLedger Optional stop ledger - events from ledgers > stopLedger will be ignored.
   */
  private async ingestLiveLedger(
    ledgerSequence: number,
    onEvent: EventHandler,
    stopLedger?: number
  ): Promise<{
    nextLedger: number;
    shouldWait: boolean;
    hitStopLedger: boolean;
  }> {
    let cursor: string | undefined = undefined;

    // Paging loop: keep fetching pages for this ledger until done
    while (this._isRunning) {
      const response = await this.fetchEvents(ledgerSequence, cursor);

      for (const event of response.events) {
        // Check if this event is past the stop ledger
        if (isDefined(stopLedger) && event.ledger > stopLedger) {
          // We've gone past the stop ledger, stop processing
          return {
            nextLedger: event.ledger,
            shouldWait: false,
            hitStopLedger: true,
          };
        }

        const hasEventBeenProcessed = this._recentlyCheckedEventsIds.includes(
          event.id
        );

        if (hasEventBeenProcessed) {
          continue;
        }

        await onEvent(event);

        // Add to circular buffer
        this._recentlyCheckedEventsIds.push(event.id);
        if (this._recentlyCheckedEventsIds.length > 25) {
          this._recentlyCheckedEventsIds.shift();
        }
      }

      // Check if we need to fetch another page
      if (response.events.length > 0 && response.cursor) {
        cursor = response.cursor;
        await this.waitFor("paging");
        continue;
      }

      // No more pages. Check chain state.

      // 1. If the latest ledger is BEHIND what we asked for, we are too fast.
      // We should stay on this ledger and wait.
      if (response.latestLedger < ledgerSequence) {
        return {
          nextLedger: ledgerSequence,
          shouldWait: true,
          hitStopLedger: false,
        };
      }

      // 2. If the latest ledger is EXACTLY what we asked for, we are at the tip.
      // We finished this ledger, but the next one probably isn't ready.
      // We should move to next, but wait first.
      if (response.latestLedger === ledgerSequence) {
        return {
          nextLedger: ledgerSequence + 1,
          shouldWait: true,
          hitStopLedger: false,
        };
      }

      // 3. If the latest ledger is AHEAD, we are catching up.
      // If the options.skipLedgerWaitIfBehind is true, We should move to next
      // immediately without waiting.
      return {
        nextLedger: ledgerSequence + 1,
        shouldWait: !this._skipLedgerWaitIfBehind,
        hitStopLedger: false,
      };
    }

    return {
      nextLedger: ledgerSequence,
      shouldWait: true,
      hitStopLedger: false,
    }; // Fallback if stopped
  }

  /**
   * Fetches events for a specific ledger sequence.
   *
   * @param ledgerSequence - The ledger sequence to fetch events from
   * @param cursor - Optional pagination cursor for fetching subsequent pages
   * @returns The events response from the RPC
   * @internal
   */
  private async fetchEvents(ledgerSequence: number, cursor?: string) {
    const filters = this.getRawFilters();

    if (cursor) {
      return await this._rpc.getEvents({
        cursor,
        filters,
        limit: this._limit,
      });
    }

    const endLedger = ledgerSequence + 1; // Fetch up to the next ledger

    return await this._rpc.getEvents({
      startLedger: ledgerSequence,
      endLedger,
      filters,
      limit: this._limit,
    });
  }
}
