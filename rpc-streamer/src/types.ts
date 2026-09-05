/**
 * Type definitions for the RPC Streamer.
 *
 * @module
 */

import type { NetworkConfig, Server } from "@/native-types.ts";

/** Choose one live RPC source. A supplied native client is reused unchanged. */
export type StreamerRpcConfig =
  | { rpcUrl: string; allowHttp?: boolean; rpc?: never; networkConfig?: never }
  | {
    networkConfig: NetworkConfig;
    rpcUrl?: never;
    rpc?: never;
    allowHttp?: never;
  }
  | { rpc: Server; rpcUrl?: never; networkConfig?: never; allowHttp?: never };

/** Optional archive source; URL and native client are mutually exclusive. */
export type StreamerArchiveConfig =
  | { archiveRpcUrl?: string; archiveAllowHttp?: boolean; archiveRpc?: never }
  | { archiveRpc: Server; archiveRpcUrl?: never; archiveAllowHttp?: never };

/**
 * Handler callback type for processing streamed data.
 * @template T - The type of data being processed
 */
export type DataHandler<T> = (data: T) => void | Promise<void>;

/**
 * Awaited after complete ledgers at the configured interval. A rejection stops
 * ingestion with CHECKPOINT_FAILED rather than skipping persistence.
 *
 * @param ledgerSequence - The current ledger sequence being processed
 *
 * @example
 * ```typescript
 * const onCheckpoint = async (ledgerSequence) => {
 *   await db.saveProgress(ledgerSequence);
 * };
 * ```
 */
export type CheckpointHandler = (
  ledgerSequence: number,
) => void | Promise<void>;

/**
 * Error handler for graceful error handling during streaming.
 * When provided, allows streaming to continue after errors.
 *
 * @param error - The error that occurred
 * @param ledgerSequence - The ledger where the error occurred
 * @returns true to continue streaming, false to stop and rethrow
 *
 * @example
 * ```typescript
 * const onError = (error, ledgerSequence) => {
 *   console.error(`Error at ledger ${ledgerSequence}:`, error);
 *   errorTracker.capture(error);
 *   return true; // Continue streaming
 * };
 * ```
 */
export type ErrorHandler = (
  error: Error,
  ledgerSequence: number,
) => boolean | void;

/**
 * Configuration options for the streamer.
 */
export interface StreamerOptions {
  /** Maximum items per request (default: 10) */
  limit?: number;
  /** Interval between ledger checks in live mode in ms (default: 5000) */
  waitLedgerIntervalMs?: number;
  /** Interval between pagination requests in ms (default: 100) */
  pagingIntervalMs?: number;
  /** Interval between archive fetches in ms (default: 500) */
  archivalIntervalMs?: number;
  /** Skip waiting when catching up to latest ledger (default: false) */
  skipLedgerWaitIfBehind?: boolean;
}

/**
 * Base options shared by all start methods.
 */
export interface BaseStartOptions {
  /** Stops between callbacks/pages and interrupts waits. In-flight SDK requests are allowed to finish. */
  signal?: AbortSignal;
  /** Checkpoint callback for progress persistence */
  onCheckpoint?: CheckpointHandler;
  /** How often to call checkpoint (in ledgers, default: 100) */
  checkpointInterval?: number;
  /** Error handler for graceful error handling */
  onError?: ErrorHandler;
}

/**
 * Options for starting live mode.
 */
export interface LiveStartOptions extends BaseStartOptions {
  /** Starting ledger sequence (defaults to latest) */
  startLedger?: number;
  /** Ending ledger sequence (optional, streams indefinitely if omitted) */
  stopLedger?: number;
}

/**
 * Options for starting archive mode.
 */
export interface ArchiveStartOptions extends BaseStartOptions {
  /** Starting ledger sequence (required) */
  startLedger: number;
  /** Ending ledger sequence (required) */
  stopLedger: number;
}

/**
 * Options for starting auto mode.
 */
export interface AutoStartOptions extends BaseStartOptions {
  /** Starting ledger sequence (defaults to latest) */
  startLedger?: number;
  /** Ending ledger sequence (optional, streams indefinitely if omitted) */
  stopLedger?: number;
}

/**
 * Internal result from live ingestion.
 */
export interface LiveIngestionResult {
  /** Next ledger to request, or the current ledger when unavailable/incomplete. */
  nextLedger: number;
  /** Request a pacing delay before another live request. */
  shouldWait: boolean;
  /** An unconsumed response is beyond the stop bound; stop without a checkpoint. */
  hitStopLedger: boolean;
}

/**
 * Live ingestion function type.
 */
export type LiveIngestFunc<T> = (
  rpc: Server,
  ledgerSequence: number,
  onData: DataHandler<T>,
  stopLedger?: number,
  context?: LiveIngestContext,
) => Promise<LiveIngestionResult>;

/** Cooperative cancellation passed to live ingestors. */
export interface LiveIngestContext {
  /** Whether the owning run still accepts more data. */
  isRunning: () => boolean;
  /** Aborted by stop() or the run's external signal. */
  signal?: AbortSignal;
}

/**
 * Archive ingestion function type.
 *
 * @param rpc - The archive RPC server instance
 * @param startLedger - Starting ledger sequence
 * @param stopLedger - Ending ledger sequence
 * @param onData - Callback to process each item
 * @param context - Context with isRunning check and optional checkpoint/error handlers
 * @returns The next ledger sequence to process
 */
export type ArchiveIngestFunc<T> = (
  rpc: Server,
  startLedger: number,
  stopLedger: number,
  onData: DataHandler<T>,
  context: ArchiveIngestContext,
) => Promise<number>;

/**
 * Context passed to archive ingestion functions.
 */
export interface ArchiveIngestContext {
  /** Aborted by stop() or the run's external signal. */
  signal?: AbortSignal;
  /** Complete a consumed ledger, awaiting persistence before advancing. Prefer this over invoking onCheckpoint directly. */
  onLedgerComplete?: (ledgerSequence: number) => Promise<void>;
  /** Function that returns whether the streamer is still running */
  isRunning: () => boolean;
  /** Optional checkpoint handler */
  onCheckpoint?: CheckpointHandler;
  /** Checkpoint interval (default: 100) */
  checkpointInterval?: number;
  /** Optional error handler */
  onError?: ErrorHandler;
}

/**
 * Configuration for creating an RPCStreamer instance.
 */
export type RPCStreamerConfig<T> = StreamerRpcConfig & StreamerArchiveConfig & {
  /** Callback for live ingestion logic (required for startLive and start) */
  ingestLive?: LiveIngestFunc<T>;
  /** Callback for archive ingestion logic (required for startArchive and start with archive) */
  ingestArchive?: ArchiveIngestFunc<T>;
  /** Optional configuration options */
  options?: StreamerOptions;
};
