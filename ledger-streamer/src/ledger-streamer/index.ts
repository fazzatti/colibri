/**
 * @module ledger-streamer/ledger-streamer
 * @description Main LedgerStreamer class for streaming Stellar ledger data.
 */

import { type Api, Server } from "stellar-sdk/rpc";
import { Ledger, isDefined, assert } from "@colibri/core";
import type {
  LedgerHandler,
  LedgerStreamerOptions,
  StartOptions,
  LiveStartOptions,
  ArchiveStartOptions,
  CheckpointHandler,
  ErrorHandler,
} from "@/types.ts";
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
 * A streaming client for Stellar blockchain ledgers that supports both live and historical ingestion.
 *
 * The LedgerStreamer provides three main modes of operation:
 * - **Live mode** (`startLive`): Streams ledgers from the current RPC retention window
 * - **Archive mode** (`startArchive`): Ingests historical ledgers from an archive RPC
 * - **Auto mode** (`start`): Automatically switches between archive and live mode based on ledger availability
 *
 * @example Basic usage
 * ```typescript
 * const streamer = new LedgerStreamer({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   archiveRpcUrl: "https://archive.stellar.org",
 *   options: { waitLedgerIntervalMs: 5000 }
 * });
 *
 * await streamer.start(async (ledger) => {
 *   console.log(`Ledger ${ledger.sequence}: ${ledger.transactions.length} txs`);
 * }, { startLedger: 1000000 });
 * ```
 *
 * @example Processing transactions
 * ```typescript
 * await streamer.start(async (ledger) => {
 *   for (const tx of ledger.transactions) {
 *     console.log(`TX ${tx.hash}: ${tx.operations.length} ops`);
 *     for (const op of tx.operations) {
 *       console.log(`  - ${op.type}`);
 *     }
 *   }
 * }, { startLedger: 1000000 });
 * ```
 */
export class LedgerStreamer {
  /** The main RPC server for live ledger streaming */
  private _rpc: Server;
  /** Optional archive RPC server for historical ledger ingestion */
  private _archiveRpc: Server | undefined = undefined;
  /** Number of ledgers to fetch per RPC request */
  private _batchSize: number = 1;
  /** Interval to wait between ledger checks in live mode (ms) */
  private _waitLedgerIntervalMs: number = 5000;
  /** Interval to wait between archive ledger fetches (ms) */
  private _archivalIntervalMs: number = 500;
  /** Whether to skip waiting when catching up to the latest ledger */
  private _skipLedgerWaitIfBehind: boolean = false;
  /** Flag indicating if the streamer is currently running */
  private _isRunning: boolean = false;

  /**
   * Creates a new LedgerStreamer instance.
   *
   * @param config - Configuration object for the streamer
   * @param config.rpcUrl - URL of the Soroban RPC server for live ledger streaming
   * @param config.archiveRpcUrl - Optional URL of an archive RPC server for historical ingestion
   * @param config.options - Optional configuration options
   * @param config.options.batchSize - Number of ledgers per request (default: 1)
   * @param config.options.waitLedgerIntervalMs - Interval between ledger checks in ms (default: 5000)
   * @param config.options.archivalIntervalMs - Interval between archive fetches in ms (default: 500)
   * @param config.options.skipLedgerWaitIfBehind - Skip waiting when catching up (default: false)
   *
   * @example
   * ```typescript
   * const streamer = new LedgerStreamer({
   *   rpcUrl: "https://soroban-testnet.stellar.org",
   *   options: { waitLedgerIntervalMs: 3000 }
   * });
   * ```
   */
  constructor({
    rpcUrl,
    archiveRpcUrl,
    options,
  }: {
    rpcUrl: string;
    archiveRpcUrl?: string;
    options?: LedgerStreamerOptions;
  }) {
    this._rpc = new Server(rpcUrl);
    if (archiveRpcUrl) this._archiveRpc = new Server(archiveRpcUrl);
    if (isDefined(options)) {
      if (isDefined(options.batchSize)) this._batchSize = options.batchSize;
      if (isDefined(options.waitLedgerIntervalMs))
        this._waitLedgerIntervalMs = options.waitLedgerIntervalMs;
      if (isDefined(options.archivalIntervalMs))
        this._archivalIntervalMs = options.archivalIntervalMs;
      if (isDefined(options.skipLedgerWaitIfBehind))
        this._skipLedgerWaitIfBehind = options.skipLedgerWaitIfBehind;
    }
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
   * Gets the current running state.
   * @returns True if the streamer is currently running
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Sets the archive RPC server by URL.
   * @param archiveRpcUrl - URL of the archive RPC server
   */
  public setArchiveRpc(archiveRpcUrl: string) {
    this._archiveRpc = new Server(archiveRpcUrl);
  }

  /**
   * Waits for a specified interval type.
   * @param interval - The type of interval to wait for
   * @returns Promise that resolves after the interval
   * @internal
   */
  private waitFor(interval: "ledger" | "archival") {
    const intervalMs =
      interval === "archival"
        ? this._archivalIntervalMs
        : this._waitLedgerIntervalMs;
    return new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  /**
   * Stops the ledger streaming process.
   *
   * This method sets the internal running flag to false, which will cause
   * any active streaming loop to exit gracefully after completing its
   * current operation.
   *
   * @example
   * ```typescript
   * // Start streaming in background
   * const streamPromise = streamer.start(handleLedger);
   *
   * // Stop after 60 seconds
   * setTimeout(() => streamer.stop(), 60000);
   *
   * await streamPromise; // Will resolve after stop is called
   * ```
   */
  public stop() {
    this._isRunning = false;
  }

  /**
   * Calls the checkpoint handler if conditions are met.
   * @param ledgerSequence - Current ledger sequence
   * @param onCheckpoint - Optional checkpoint handler
   * @param checkpointInterval - Interval between checkpoints
   * @internal
   */
  private maybeCheckpoint(
    ledgerSequence: number,
    onCheckpoint?: CheckpointHandler,
    checkpointInterval: number = 100
  ) {
    if (onCheckpoint && ledgerSequence % checkpointInterval === 0) {
      onCheckpoint(ledgerSequence);
    }
  }

  /**
   * Handles an error during streaming.
   * @param error - The error that occurred
   * @param ledgerSequence - The ledger where the error occurred
   * @param onError - Optional error handler
   * @returns True if the error was handled, false if it should be rethrown
   * @internal
   */
  private handleError(
    error: Error,
    ledgerSequence: number,
    onError?: ErrorHandler
  ): boolean {
    if (onError) {
      onError(error, ledgerSequence);
      return true;
    }
    return false;
  }

  /**
   * Starts live-only ingestion using the standard RPC.
   * Will throw if the requested ledger range is outside the RPC retention window.
   * Does NOT auto-switch to historical mode.
   *
   * @param onLedger - Callback to process each ledger
   * @param options - Start options including startLedger and stopLedger
   *
   * @throws {STREAMER_ALREADY_RUNNING} If the streamer is already running
   * @throws {RPC_NOT_HEALTHY} If the RPC server is not healthy
   * @throws {LEDGER_TOO_OLD} If startLedger is older than RPC retention
   * @throws {LEDGER_TOO_HIGH} If startLedger is higher than latest available
   *
   * @example
   * ```typescript
   * await streamer.startLive(async (ledger) => {
   *   console.log(`Ledger ${ledger.sequence}`);
   * }, { startLedger: 1000000 });
   * ```
   */
  public async startLive(
    onLedger: LedgerHandler,
    options: LiveStartOptions = {}
  ) {
    assert(!this._isRunning, new E.STREAMER_ALREADY_RUNNING());

    this._isRunning = true;

    try {
      const rpcDetails = (await this._rpc.getHealth()) as GetHealthResponse;

      assert(rpcDetails.status === "healthy", new E.RPC_NOT_HEALTHY());

      let currentLedger = options.startLedger ?? rpcDetails.latestLedger;
      const oldestAvailable = rpcDetails.oldestLedger + 2; // +2 safety buffer

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
          isDefined(options.stopLedger) &&
          currentLedger > options.stopLedger
        ) {
          this.stop();
          break;
        }

        try {
          const { nextLedger, shouldWait, hitStopLedger } =
            await this.ingestLiveLedger(
              currentLedger,
              onLedger,
              options.stopLedger,
              options.onCheckpoint,
              options.checkpointInterval
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
        } catch (error) {
          if (
            !this.handleError(error as Error, currentLedger, options.onError)
          ) {
            throw error;
          }
          // If error was handled, continue to next ledger
          currentLedger++;
        }
      }
    } finally {
      this._isRunning = false;
    }
  }

  /**
   * Starts archive-only ingestion using the Archive RPC.
   * Will throw if no archive RPC is configured or if the ledger range is invalid.
   * Does NOT auto-switch to live mode.
   *
   * @param onLedger - Callback to process each ledger
   * @param options - Archive options (startLedger and stopLedger are required)
   *
   * @throws {STREAMER_ALREADY_RUNNING} If the streamer is already running
   * @throws {MISSING_ARCHIVE_RPC} If no archive RPC is configured
   * @throws {INVALID_INGESTION_RANGE} If startLedger > stopLedger
   *
   * @example
   * ```typescript
   * await streamer.startArchive(async (ledger) => {
   *   console.log(`Historical ledger ${ledger.sequence}`);
   * }, { startLedger: 1, stopLedger: 999999 });
   * ```
   */
  public async startArchive(
    onLedger: LedgerHandler,
    options: ArchiveStartOptions
  ) {
    assert(!this._isRunning, new E.STREAMER_ALREADY_RUNNING());
    assert(isDefined(this._archiveRpc), new E.MISSING_ARCHIVE_RPC());
    assert(
      options.startLedger <= options.stopLedger,
      new E.INVALID_INGESTION_RANGE(options.startLedger, options.stopLedger)
    );

    this._isRunning = true;

    try {
      await this.ingestHistoricalLedgers(
        options.startLedger,
        options.stopLedger,
        onLedger,
        options.onError,
        options.onCheckpoint,
        options.checkpointInterval
      );
    } finally {
      this._isRunning = false;
    }
  }

  /**
   * Starts the ingestion process with automatic mode switching.
   * Routes to historical or live ingestion based on ledger availability.
   *
   * This is the recommended way to start streaming as it:
   * 1. Uses archive RPC for ledgers before the retention window
   * 2. Automatically switches to live RPC when caught up
   * 3. Handles the transition seamlessly
   *
   * @param onLedger - Callback to process each ledger
   * @param options - Optional start and stop ledgers
   *
   * @throws {STREAMER_ALREADY_RUNNING} If the streamer is already running
   * @throws {RPC_NOT_HEALTHY} If the RPC server is not healthy
   *
   * @example
   * ```typescript
   * // Stream from genesis to present (and beyond)
   * await streamer.start(async (ledger) => {
   *   console.log(`Ledger ${ledger.sequence}`);
   * }, { startLedger: 1 });
   * ```
   */
  public async start(onLedger: LedgerHandler, options: StartOptions = {}) {
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
          const targetLedger = isDefined(options.stopLedger)
            ? Math.min(oldestAvailable - 1, options.stopLedger)
            : oldestAvailable - 1;

          // Ingest historical ledgers until we reach the target
          try {
            currentLedger = await this.ingestHistoricalLedgers(
              currentLedger,
              targetLedger,
              onLedger,
              options.onError,
              options.onCheckpoint,
              options.checkpointInterval
            );
          } catch (error) {
            if (
              !this.handleError(error as Error, currentLedger, options.onError)
            ) {
              throw error;
            }
          }

          // Loop back to re-check (oldestAvailable may have shifted)
          continue;
        }

        // Live mode: use standard RPC
        try {
          const { nextLedger, shouldWait, hitStopLedger } =
            await this.ingestLiveLedger(
              currentLedger,
              onLedger,
              options.stopLedger,
              options.onCheckpoint,
              options.checkpointInterval
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
        } catch (error) {
          if (
            !this.handleError(error as Error, currentLedger, options.onError)
          ) {
            throw error;
          }
          currentLedger++;
        }
      }
    } finally {
      this._isRunning = false;
    }
  }

  /**
   * Ingests ledgers from historical archive using the Archive RPC.
   * Uses getLedgers() to fetch raw ledger data.
   *
   * @param startLedger - The ledger to start ingesting from (inclusive)
   * @param stopLedger - The ledger to stop ingesting at (inclusive)
   * @param onLedger - Callback to process each ledger
   * @param onError - Optional error handler
   * @param onCheckpoint - Optional checkpoint handler
   * @param checkpointInterval - Interval between checkpoints
   * @returns The next ledger to process after finishing the range
   * @internal
   */
  private async ingestHistoricalLedgers(
    startLedger: number,
    stopLedger: number,
    onLedger: LedgerHandler,
    onError?: ErrorHandler,
    onCheckpoint?: CheckpointHandler,
    checkpointInterval: number = 100
  ): Promise<number> {
    assert(isDefined(this._archiveRpc), new E.MISSING_ARCHIVE_RPC());

    let currentLedger = startLedger;

    while (this._isRunning && currentLedger <= stopLedger) {
      try {
        // Use _getLedgers to get raw XDR strings (RawLedgerResponse)
        // instead of getLedgers which returns pre-parsed XDR objects
        const ledgerData = await this._archiveRpc._getLedgers({
          startLedger: currentLedger,
          pagination: { limit: this._batchSize },
        });

        for (const entry of ledgerData.ledgers) {
          if (!this._isRunning) break;
          if (entry.sequence > stopLedger) break;

          const ledger = Ledger.fromEntry(entry);
          await onLedger(ledger);

          this.maybeCheckpoint(
            entry.sequence,
            onCheckpoint,
            checkpointInterval
          );
        }

        // Move to next batch
        const lastSequence =
          ledgerData.ledgers[ledgerData.ledgers.length - 1]?.sequence;
        currentLedger = lastSequence ? lastSequence + 1 : currentLedger + 1;

        if (currentLedger <= stopLedger && this._isRunning) {
          await this.waitFor("archival");
        }
      } catch (error) {
        if (!this.handleError(error as Error, currentLedger, onError)) {
          throw error;
        }
        currentLedger++;
      }
    }

    return currentLedger;
  }

  /**
   * Ingests a single ledger using the standard RPC.
   * Returns the next ledger sequence and whether we should wait before proceeding.
   *
   * @param ledgerSequence - The ledger to ingest
   * @param onLedger - Callback to process the ledger
   * @param stopLedger - Optional stop ledger
   * @param onCheckpoint - Optional checkpoint handler
   * @param checkpointInterval - Interval between checkpoints
   * @returns Object with nextLedger, shouldWait, and hitStopLedger flags
   * @internal
   */
  private async ingestLiveLedger(
    ledgerSequence: number,
    onLedger: LedgerHandler,
    stopLedger?: number,
    onCheckpoint?: CheckpointHandler,
    checkpointInterval: number = 100
  ): Promise<{
    nextLedger: number;
    shouldWait: boolean;
    hitStopLedger: boolean;
  }> {
    // Use _getLedgers to get raw XDR strings (RawLedgerResponse)
    // instead of getLedgers which returns pre-parsed XDR objects
    const response = await this._rpc._getLedgers({
      startLedger: ledgerSequence,
      pagination: { limit: 1 },
    });

    // Check if we got any ledgers
    if (response.ledgers.length === 0) {
      // No ledger available yet, wait and retry
      return {
        nextLedger: ledgerSequence,
        shouldWait: true,
        hitStopLedger: false,
      };
    }

    const entry = response.ledgers[0];

    // Check if this ledger is past the stop ledger
    if (isDefined(stopLedger) && entry.sequence > stopLedger) {
      return {
        nextLedger: entry.sequence,
        shouldWait: false,
        hitStopLedger: true,
      };
    }

    const ledger = Ledger.fromEntry(entry);
    await onLedger(ledger);

    this.maybeCheckpoint(entry.sequence, onCheckpoint, checkpointInterval);

    // Determine if we should wait based on how close we are to latest
    const latestLedger = response.latestLedger ?? entry.sequence;

    // If we're at or past the latest, we should wait
    if (entry.sequence >= latestLedger) {
      return {
        nextLedger: entry.sequence + 1,
        shouldWait: true,
        hitStopLedger: false,
      };
    }

    // We're behind, respect skipLedgerWaitIfBehind setting
    return {
      nextLedger: entry.sequence + 1,
      shouldWait: !this._skipLedgerWaitIfBehind,
      hitStopLedger: false,
    };
  }
}
