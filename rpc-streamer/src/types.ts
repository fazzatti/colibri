/**
 * Type definitions for the RPC Streamer.
 *
 * @module
 */

import type { Server } from "stellar-sdk/rpc";

/**
 * Handler callback type for processing streamed data.
 * @template T - The type of data being processed
 */
export type DataHandler<T> = (data: T) => void | Promise<void>;

/**
 * Checkpoint handler called periodically during streaming.
 * Use this to persist progress for resumption after crashes/restarts.
 *
 * @param ledgerSequence - The current ledger sequence being processed
 *
 * @example
 * ```typescript
 * const onCheckpoint = (ledgerSequence) => {
 *   db.saveProgress(ledgerSequence);
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
  nextLedger: number;
  shouldWait: boolean;
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
) => Promise<LiveIngestionResult>;

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
export interface RPCStreamerConfig<T> {
  /** URL of the Soroban RPC server for live streaming */
  rpcUrl: string;
  /** Optional URL of an archive RPC server for historical ingestion */
  archiveRpcUrl?: string;
  /** Callback for live ingestion logic (required for startLive and start) */
  ingestLive?: LiveIngestFunc<T>;
  /** Callback for archive ingestion logic (required for startArchive and start with archive) */
  ingestArchive?: ArchiveIngestFunc<T>;
  /** Optional configuration options */
  options?: StreamerOptions;
}
