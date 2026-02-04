/**
 * Generic RPC Streamer implementation with callback-based API.
 *
 * This module provides the core RPCStreamer class that handles all common streaming
 * logic including health checks, archive→live transitions, and error handling.
 * Uses a callback pattern similar to the legacy EventStreamer and LedgerStreamer.
 *
 * @module
 */

import { Server } from "stellar-sdk/rpc";
import type { Event, Ledger } from "@colibri/core";
import { isDefined } from "@colibri/core";
import { RPCStreamerError, RPCStreamerErrorCode } from "@/errors.ts";
import { createEventStreamer } from "@/variants/event/index.ts";
import type { EventStreamerConfig } from "@/variants/event/types.ts";
import { createLedgerStreamer } from "@/variants/ledger/index.ts";
import type { LedgerStreamerConfig } from "@/variants/ledger/types.ts";
import type {
  DataHandler,
  CheckpointHandler,
  ErrorHandler,
  LiveStartOptions,
  ArchiveStartOptions,
  AutoStartOptions,
  LiveIngestFunc,
  ArchiveIngestFunc,
  RPCStreamerConfig,
} from "@/types.ts";

/**
 * Generic RPC streaming class with callback-based API.
 *
 * Handles common streaming logic (health checks, transitions, error handling)
 * while delegating data fetching to variant-specific implementations provided
 * via constructor callbacks.
 *
 * @template T - The type of data being streamed
 *
 * @example
 * ```typescript
 * const streamer = new RPCStreamer<Event>({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   ingestLive: myLiveIngestor,
 *   ingestArchive: myArchiveIngestor,
 * });
 *
 * await streamer.start(async (event) => {
 *   console.log("Event received:", event);
 * }, { startLedger: 1000000 });
 * ```
 */
export class RPCStreamer<T> {
  /** The main RPC server for live streaming */
  protected _rpc: Server;
  /** Optional archive RPC server for historical ingestion */
  protected _archiveRpc: Server | undefined = undefined;

  /** Maximum items per request */
  protected _limit: number = 10;
  /** Interval to wait between ledger checks in live mode (ms) */
  protected _waitLedgerIntervalMs: number = 5000;
  /** Interval between pagination requests (ms) */
  protected _pagingIntervalMs: number = 100;
  /** Interval to wait between archive ledger fetches (ms) */
  protected _archivalIntervalMs: number = 500;
  /** Whether to skip waiting when catching up to the latest ledger */
  protected _skipLedgerWaitIfBehind: boolean = false;

  /** Flag indicating if the streamer is currently running */
  protected _isRunning: boolean = false;

  /** Live ingestion callback provided by variant */
  private readonly _ingestLive?: LiveIngestFunc<T>;

  /** Archive ingestion callback provided by variant */
  private readonly _ingestArchive?: ArchiveIngestFunc<T>;

  /**
   * Creates a new RPCStreamer instance.
   *
   * @param config - Configuration object for the streamer
   *
   * @throws {INVALID_CONFIG} If pagingIntervalMs exceeds waitLedgerIntervalMs
   */
  constructor(config: RPCStreamerConfig<T>) {
    this._rpc = new Server(config.rpcUrl);
    if (config.archiveRpcUrl)
      this._archiveRpc = new Server(config.archiveRpcUrl);

    this._ingestLive = config.ingestLive;
    this._ingestArchive = config.ingestArchive;

    if (isDefined(config.options)) {
      const options = config.options;
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

    if (this._pagingIntervalMs > this._waitLedgerIntervalMs) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.INVALID_CONFIG,
        `pagingIntervalMs (${this._pagingIntervalMs}) cannot exceed waitLedgerIntervalMs (${this._waitLedgerIntervalMs})`,
      );
    }
  }

  /**
   * Gets the current RPC server instance.
   */
  get rpc(): Server {
    return this._rpc;
  }

  /**
   * Sets the RPC server instance.
   * @throws {RPC_ALREADY_SET} If an RPC server is already configured
   */
  set rpc(rpc: Server) {
    if (isDefined(this._rpc)) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.RPC_ALREADY_SET,
        "RPC server is already set",
      );
    }
    this._rpc = rpc;
  }

  /**
   * Gets the current archive RPC server instance.
   */
  get archiveRpc(): Server | undefined {
    return this._archiveRpc;
  }

  /**
   * Sets the archive RPC server instance.
   * @throws {ARCHIVE_RPC_ALREADY_SET} If an archive RPC server is already configured
   */
  set archiveRpc(archiveRpc: Server) {
    if (isDefined(this._archiveRpc)) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.ARCHIVE_RPC_ALREADY_SET,
        "Archive RPC server is already set",
      );
    }
    this._archiveRpc = archiveRpc;
  }

  /**
   * Gets the current running state.
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Sets the archive RPC server by URL.
   * @param archiveRpcUrl - URL of the archive RPC server
   */
  public setArchiveRpc(archiveRpcUrl: string): void {
    this._archiveRpc = new Server(archiveRpcUrl);
  }

  /**
   * Waits for a specified interval type.
   * @param interval - The type of interval to wait for
   */
  protected waitFor(interval: "paging" | "ledger" | "archival"): Promise<void> {
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
   * Stops the streaming process.
   *
   * This method sets the internal running flag to false, which will cause
   * any active streaming loop to exit gracefully after completing its
   * current operation.
   *
   * @example
   * ```typescript
   * const streamPromise = streamer.start(handleData);
   * setTimeout(() => streamer.stop(), 10000);
   * await streamPromise;
   * ```
   */
  public stop(): void {
    this._isRunning = false;
  }

  /**
   * Calls the checkpoint handler if conditions are met.
   *
   * @param ledgerSequence - Current ledger sequence
   * @param onCheckpoint - Optional checkpoint handler
   * @param checkpointInterval - Interval between checkpoints (default: 100)
   * @internal
   */
  protected maybeCheckpoint(
    ledgerSequence: number,
    onCheckpoint?: CheckpointHandler,
    checkpointInterval: number = 100,
  ): void {
    if (onCheckpoint && ledgerSequence % checkpointInterval === 0) {
      onCheckpoint(ledgerSequence);
    }
  }

  /**
   * Handles an error during streaming.
   *
   * @param error - The error that occurred
   * @param ledgerSequence - The ledger where the error occurred
   * @param onError - Optional error handler
   * @returns true if error was handled and streaming should continue, false to rethrow
   * @internal
   */
  protected handleError(
    error: Error,
    ledgerSequence: number,
    onError?: ErrorHandler,
  ): boolean {
    if (onError) {
      const result = onError(error, ledgerSequence);
      // If handler returns false explicitly, rethrow. Otherwise continue.
      return result !== false;
    }
    return false; // No handler, rethrow
  }

  /**
   * Starts live-only ingestion using the standard RPC.
   *
   * Will throw if the requested ledger range is outside the RPC retention window.
   * Does NOT auto-switch to historical mode.
   *
   * @param onData - Callback to process each item
   * @param options - Start and stop ledgers
   *
   * @throws {ALREADY_RUNNING} If the streamer is already running
   * @throws {RPC_NOT_HEALTHY} If the RPC server is not healthy
   * @throws {LEDGER_TOO_OLD} If startLedger is older than RPC retention
   * @throws {LEDGER_TOO_HIGH} If startLedger is higher than latest available
   *
   * @example
   * ```typescript
   * await streamer.startLive(async (event) => {
   *   console.log("Event:", event);
   * }, { startLedger: 1000000, stopLedger: 1001000 });
   * ```
   */
  public async startLive(
    onData: DataHandler<T>,
    options: LiveStartOptions = {},
  ): Promise<void> {
    if (this._isRunning) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.ALREADY_RUNNING,
        "Streamer is already running",
      );
    }

    if (!this._ingestLive) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.MISSING_LIVE_INGESTOR,
        "Live ingestor is required for live streaming",
      );
    }

    this._isRunning = true;

    try {
      const rpcDetails = await this._rpc.getHealth();

      if (rpcDetails.status !== "healthy") {
        throw new RPCStreamerError(
          RPCStreamerErrorCode.RPC_NOT_HEALTHY,
          "Live RPC is not healthy",
        );
      }

      let currentLedger = options.startLedger ?? rpcDetails.latestLedger;
      const oldestAvailable = rpcDetails.oldestLedger + 2; // +2 safety buffer

      if (currentLedger < oldestAvailable) {
        throw new RPCStreamerError(
          RPCStreamerErrorCode.LEDGER_TOO_OLD,
          `Ledger ${currentLedger} is older than oldest available (${oldestAvailable})`,
        );
      }

      if (currentLedger > rpcDetails.latestLedger) {
        throw new RPCStreamerError(
          RPCStreamerErrorCode.LEDGER_TOO_HIGH,
          `Ledger ${currentLedger} is higher than latest available (${rpcDetails.latestLedger})`,
        );
      }

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
            await this._ingestLive(
              this._rpc,
              currentLedger,
              onData,
              options.stopLedger,
            );

          if (hitStopLedger) {
            this.stop();
            break;
          }

          // Checkpoint after successful ingestion
          this.maybeCheckpoint(
            currentLedger,
            options.onCheckpoint,
            options.checkpointInterval,
          );

          currentLedger = nextLedger;

          // Don't wait if we're about to stop
          if (
            shouldWait &&
            (options.stopLedger === undefined ||
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
          // Error was handled, move to next ledger
          currentLedger++;
        }
      }
    } finally {
      this._isRunning = false;
    }
  }

  /**
   * Starts archive-only ingestion using the Archive RPC.
   *
   * Will throw if no archive RPC is configured or if the ledger range is invalid.
   * Does NOT auto-switch to live mode.
   *
   * @param onData - Callback to process each item
   * @param options - Start and stop ledgers (both required)
   *
   * @throws {ALREADY_RUNNING} If the streamer is already running
   * @throws {MISSING_ARCHIVE_RPC} If no archive RPC is configured
   * @throws {INVALID_SEQUENCE_RANGE} If startLedger > stopLedger
   *
   * @example
   * ```typescript
   * await streamer.startArchive(async (event) => {
   *   console.log("Historical event:", event);
   * }, { startLedger: 1000000, stopLedger: 1100000 });
   * ```
   */
  public async startArchive(
    onData: DataHandler<T>,
    options: ArchiveStartOptions,
  ): Promise<void> {
    if (this._isRunning) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.ALREADY_RUNNING,
        "Streamer is already running",
      );
    }

    if (!this._ingestArchive) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.MISSING_ARCHIVE_INGESTOR,
        "Archive ingestor is required for archive streaming",
      );
    }

    if (!isDefined(this._archiveRpc)) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.MISSING_ARCHIVE_RPC,
        "Archive RPC is required for archive ingestion",
      );
    }

    if (options.startLedger > options.stopLedger) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.INVALID_SEQUENCE_RANGE,
        `Invalid ingestion range: ${options.startLedger} > ${options.stopLedger}`,
      );
    }

    this._isRunning = true;

    try {
      await this._ingestArchive(
        this._archiveRpc,
        options.startLedger,
        options.stopLedger,
        onData,
        {
          isRunning: () => this._isRunning,
          onCheckpoint: options.onCheckpoint,
          checkpointInterval: options.checkpointInterval,
          onError: options.onError,
        },
      );
      this.stop();
    } finally {
      this._isRunning = false;
    }
  }

  /**
   * Starts the ingestion process in auto mode.
   *
   * Routes to historical or live ingestion based on ledger availability.
   * Automatically switches from archive to live mode when caught up.
   *
   * @param onData - Callback to process each item
   * @param options - Optional start and end ledgers
   *
   * @throws {ALREADY_RUNNING} If the streamer is already running
   * @throws {RPC_NOT_HEALTHY} If the RPC server is not healthy
   * @throws {LEDGER_TOO_OLD} If startLedger is too old and no archive RPC configured
   * @throws {LEDGER_TOO_HIGH} If startLedger is higher than latest available
   *
   * @example
   * ```typescript
   * await streamer.start(async (event) => {
   *   console.log("Event:", event);
   * }, { startLedger: 1000000 });
   * ```
   */
  public async start(
    onData: DataHandler<T>,
    options: AutoStartOptions = {},
  ): Promise<void> {
    if (this._isRunning) {
      throw new RPCStreamerError(
        RPCStreamerErrorCode.ALREADY_RUNNING,
        "Streamer is already running",
      );
    }

    this._isRunning = true;

    try {
      const rpcDetails = await this._rpc.getHealth();

      if (rpcDetails.status !== "healthy") {
        throw new RPCStreamerError(
          RPCStreamerErrorCode.RPC_NOT_HEALTHY,
          "Live RPC is not healthy",
        );
      }

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
        const health = await this._rpc.getHealth();
        const oldestAvailable = health.oldestLedger + 2; // +2 safety buffer

        if (currentLedger > health.latestLedger) {
          throw new RPCStreamerError(
            RPCStreamerErrorCode.LEDGER_TOO_HIGH,
            `Ledger ${currentLedger} is higher than latest available (${health.latestLedger})`,
          );
        }

        if (currentLedger < oldestAvailable) {
          // Historical mode: requires an archive RPC and archive ingestor
          if (!isDefined(this._archiveRpc)) {
            throw new RPCStreamerError(
              RPCStreamerErrorCode.LEDGER_TOO_OLD,
              `Ledger ${currentLedger} is older than oldest available (${oldestAvailable}). Configure an archive RPC to access historical data.`,
            );
          }

          if (!this._ingestArchive) {
            throw new RPCStreamerError(
              RPCStreamerErrorCode.MISSING_ARCHIVE_INGESTOR,
              `Ledger ${currentLedger} is older than oldest available (${oldestAvailable}). Archive ingestor is required to access historical data.`,
            );
          }

          // Determine target: either stopLedger or oldestAvailable-1 (whichever is smaller)
          const targetLedger = isDefined(options.stopLedger)
            ? Math.min(oldestAvailable - 1, options.stopLedger)
            : oldestAvailable - 1;

          try {
            // Ingest historical ledgers until we reach the target
            currentLedger = await this._ingestArchive(
              this._archiveRpc,
              currentLedger,
              targetLedger,
              onData,
              {
                isRunning: () => this._isRunning,
                onCheckpoint: options.onCheckpoint,
                checkpointInterval: options.checkpointInterval,
                onError: options.onError,
              },
            );
          } catch (error) {
            if (
              !this.handleError(error as Error, currentLedger, options.onError)
            ) {
              throw error;
            }
            // Error was handled, move to next ledger
            currentLedger++;
          }

          // Loop back to re-check (oldestAvailable may have shifted)
          continue;
        }

        // Live mode: use standard RPC
        if (!this._ingestLive) {
          throw new RPCStreamerError(
            RPCStreamerErrorCode.MISSING_LIVE_INGESTOR,
            "Live ingestor is required for live streaming",
          );
        }

        try {
          const { nextLedger, shouldWait, hitStopLedger } =
            await this._ingestLive(
              this._rpc,
              currentLedger,
              onData,
              options.stopLedger,
            );

          if (hitStopLedger) {
            this.stop();
            break;
          }

          // Checkpoint after successful ingestion
          this.maybeCheckpoint(
            currentLedger,
            options.onCheckpoint,
            options.checkpointInterval,
          );

          currentLedger = nextLedger;

          // Don't wait if we're about to stop
          if (
            isDefined(options.stopLedger) &&
            currentLedger > options.stopLedger
          ) {
            this.stop();
            break;
          }

          // Wait only if we're caught up to the latest ledger
          if (shouldWait) {
            // Check if we should skip wait when behind
            if (this._skipLedgerWaitIfBehind) {
              const latestLedger = (await this._rpc.getHealth()).latestLedger;
              if (currentLedger < latestLedger - 1) {
                continue;
              }
            }
            await this.waitFor("ledger");
          }
        } catch (error) {
          if (
            !this.handleError(error as Error, currentLedger, options.onError)
          ) {
            throw error;
          }
          // Error was handled, move to next ledger
          currentLedger++;
        }
      }
    } finally {
      this._isRunning = false;
    }
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a pre-configured streamer for Stellar events.
   *
   * @param config - Configuration for the event streamer
   * @returns A configured RPCStreamer instance for Event objects
   *
   * @example
   * ```typescript
   * const streamer = RPCStreamer.event({
   *   rpcUrl: "https://soroban-testnet.stellar.org",
   *   filters: [new EventFilter({ contractId: "C..." })],
   * });
   *
   * await streamer.start(async (event) => {
   *   console.log("Event:", event.id);
   * }, { startLedger: 1000000 });
   * ```
   */
  static event(config: EventStreamerConfig): RPCStreamer<Event> {
    return createEventStreamer(config);
  }

  /**
   * Creates a pre-configured streamer for Stellar ledgers.
   *
   * @param config - Configuration for the ledger streamer
   * @returns A configured RPCStreamer instance for Ledger objects
   *
   * @example
   * ```typescript
   * const streamer = RPCStreamer.ledger({
   *   rpcUrl: "https://soroban-testnet.stellar.org",
   *   archiveRpcUrl: "https://archive-rpc.example.com",
   * });
   *
   * await streamer.start(async (ledger) => {
   *   console.log(`Ledger ${ledger.sequence}: ${ledger.transactionCount} txs`);
   * }, { startLedger: 1000000 });
   * ```
   */
  static ledger(config: LedgerStreamerConfig): RPCStreamer<Ledger> {
    return createLedgerStreamer(config);
  }
}
