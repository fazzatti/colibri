/**
 * @module ledger-streamer/types
 * @description Type definitions for the Ledger Streamer.
 */

import type { Ledger } from "@colibri/core";

/**
 * Handler function for processing ledgers.
 *
 * Called for each ledger as it's received from the RPC. Can be either
 * synchronous or asynchronous.
 *
 * @param ledger - The parsed ledger to process
 * @returns void or a Promise that resolves when processing is complete
 *
 * @example Synchronous handler
 * ```typescript
 * const handler: LedgerHandler = (ledger) => {
 *   console.log(`Ledger ${ledger.sequence}`);
 * };
 * ```
 *
 * @example Asynchronous handler
 * ```typescript
 * const handler: LedgerHandler = async (ledger) => {
 *   await database.saveLedger(ledger);
 *   console.log(`Saved ledger ${ledger.sequence}`);
 * };
 * ```
 */
export type LedgerHandler = (ledger: Ledger) => void | Promise<void>;

/**
 * Error handler function for processing errors during streaming.
 *
 * Called when an error occurs during ledger processing or RPC communication.
 * Can be used for custom error handling, logging, or recovery logic.
 *
 * @param error - The error that occurred
 * @param ledgerSequence - The ledger sequence where the error occurred (if known)
 *
 * @example
 * ```typescript
 * const errorHandler: ErrorHandler = (error, ledgerSequence) => {
 *   console.error(`Error at ledger ${ledgerSequence}:`, error);
 *   // Send to error tracking service
 *   errorTracker.captureException(error, { ledgerSequence });
 * };
 * ```
 */
export type ErrorHandler = (error: Error, ledgerSequence?: number) => void;

/**
 * Callback for checkpoint/cursor updates.
 *
 * Called periodically with the current ledger sequence being processed.
 * Use this to persist the cursor for resumption after crashes or restarts.
 *
 * @param ledgerSequence - The current ledger sequence
 *
 * @example
 * ```typescript
 * const checkpointHandler: CheckpointHandler = (ledgerSequence) => {
 *   localStorage.setItem('lastProcessedLedger', ledgerSequence.toString());
 * };
 *
 * // On restart
 * const startLedger = parseInt(localStorage.getItem('lastProcessedLedger') || '0') + 1;
 * await streamer.start(handler, { startLedger, onCheckpoint: checkpointHandler });
 * ```
 */
export type CheckpointHandler = (ledgerSequence: number) => void;

/**
 * Configuration options for LedgerStreamer.
 *
 * @example
 * ```typescript
 * const streamer = new LedgerStreamer({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   archiveRpcUrl: "https://archive.stellar.org",
 *   options: {
 *     batchSize: 10,
 *     waitLedgerIntervalMs: 3000,
 *     archivalIntervalMs: 100
 *   }
 * });
 * ```
 */
export interface LedgerStreamerOptions {
  /**
   * Number of ledgers to fetch per RPC request.
   *
   * Higher values = fewer RPC calls, more memory usage.
   * Lower values = more RPC calls, less memory usage.
   *
   * **Trade-offs:**
   * - `batchSize: 1` - Minimal memory, maximum RPC calls (default)
   * - `batchSize: 10` - Balanced approach
   * - `batchSize: 100` - Fast backfill, high memory usage
   *
   * @default 1
   *
   * @example
   * ```typescript
   * // For fast historical backfill
   * options: { batchSize: 50 }
   *
   * // For memory-constrained environments
   * options: { batchSize: 1 }
   * ```
   */
  batchSize?: number;

  /**
   * Interval between ledger checks in live mode (milliseconds).
   *
   * How long to wait before checking for new ledgers when caught up
   * to the latest available ledger.
   *
   * @default 5000 (5 seconds)
   *
   * @example
   * ```typescript
   * // Check for new ledgers every 2 seconds
   * options: { waitLedgerIntervalMs: 2000 }
   * ```
   */
  waitLedgerIntervalMs?: number;

  /**
   * Interval between archive ledger fetches (milliseconds).
   *
   * When streaming from archival RPC, how long to wait between
   * batch requests. Lower = faster backfill, higher RPC load.
   *
   * @default 500 (0.5 seconds)
   *
   * @example
   * ```typescript
   * // Faster backfill (be respectful of RPC rate limits)
   * options: { archivalIntervalMs: 100 }
   *
   * // Slower, more respectful of RPC
   * options: { archivalIntervalMs: 1000 }
   * ```
   */
  archivalIntervalMs?: number;

  /**
   * Whether to skip waiting when behind the latest ledger.
   *
   * In live mode, if we're behind the latest ledger (e.g., catching up),
   * setting this to `true` will fetch the next batch immediately without
   * waiting `waitLedgerIntervalMs`.
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Fast catch-up mode
   * options: { skipLedgerWaitIfBehind: true }
   * ```
   */
  skipLedgerWaitIfBehind?: boolean;
}

/**
 * Options for starting a streaming session.
 *
 * @example
 * ```typescript
 * await streamer.start(handler, {
 *   startLedger: 1000000,
 *   stopLedger: 2000000,
 *   onError: (err, seq) => console.error(err),
 *   onCheckpoint: (seq) => saveCheckpoint(seq)
 * });
 * ```
 */
export interface StartOptions {
  /**
   * Ledger sequence number to start streaming from.
   *
   * @example
   * ```typescript
   * { startLedger: 1 }  // Start from genesis
   * { startLedger: 1000000 }  // Start from a specific ledger
   * ```
   */
  startLedger?: number;

  /**
   * Optional ledger sequence to stop at (inclusive).
   *
   * If not specified, streaming continues indefinitely (live mode).
   * If specified, streaming stops after processing this ledger.
   *
   * @example
   * ```typescript
   * // Stream a specific range
   * { startLedger: 1000000, stopLedger: 1001000 }
   *
   * // Stream forever (live)
   * { startLedger: 1000000 }  // stopLedger omitted
   * ```
   */
  stopLedger?: number;

  /**
   * Optional error handler.
   *
   * Called when errors occur during streaming. If not provided,
   * errors will cause the stream to stop.
   *
   * @example
   * ```typescript
   * {
   *   onError: (error, ledgerSequence) => {
   *     console.error(`Error at ledger ${ledgerSequence}:`, error);
   *   }
   * }
   * ```
   */
  onError?: ErrorHandler;

  /**
   * Optional checkpoint handler.
   *
   * Called periodically with the current ledger sequence being processed.
   * Use this to persist progress for resumption.
   *
   * @example
   * ```typescript
   * {
   *   onCheckpoint: (ledgerSequence) => {
   *     db.saveCheckpoint(ledgerSequence);
   *   }
   * }
   * ```
   */
  onCheckpoint?: CheckpointHandler;

  /**
   * How often to call the checkpoint handler (in number of ledgers).
   *
   * @default 100
   *
   * @example
   * ```typescript
   * // Checkpoint every 10 ledgers
   * { checkpointInterval: 10 }
   * ```
   */
  checkpointInterval?: number;
}

/**
 * Options specifically for live streaming mode.
 */
export interface LiveStartOptions extends StartOptions {
  /**
   * Ledger sequence number to start streaming from.
   * If not provided, starts from the latest available ledger.
   */
  startLedger?: number;
}

/**
 * Options specifically for archive streaming mode.
 */
export interface ArchiveStartOptions {
  /**
   * Ledger sequence number to start streaming from.
   */
  startLedger: number;

  /**
   * Ledger sequence number to stop at (inclusive).
   */
  stopLedger: number;

  /**
   * Optional error handler.
   */
  onError?: ErrorHandler;

  /**
   * Optional checkpoint handler.
   */
  onCheckpoint?: CheckpointHandler;

  /**
   * How often to call the checkpoint handler (in number of ledgers).
   * @default 100
   */
  checkpointInterval?: number;
}
