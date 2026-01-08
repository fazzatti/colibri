/**
 * @module ledger-streamer
 * @description Streaming client for Stellar blockchain ledgers.
 *
 * This package provides the `LedgerStreamer` class for continuous ingestion
 * of Stellar ledger data from both live and archival RPC endpoints.
 *
 * The ledger-streamer complements the event-streamer package:
 * - **event-streamer**: Filters and streams specific contract events
 * - **ledger-streamer**: Streams complete ledger data for full blockchain indexing
 *
 * @example Basic usage
 * ```typescript
 * import { LedgerStreamer } from "@colibri/ledger-streamer";
 *
 * const streamer = new LedgerStreamer({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   archiveRpcUrl: "https://archive.stellar.org"
 * });
 *
 * await streamer.start(async (ledger) => {
 *   console.log(`Ledger ${ledger.sequence}: ${ledger.transactions.length} txs`);
 * }, { startLedger: 1000000 });
 * ```
 *
 * @example Three streaming modes
 * ```typescript
 * // 1. Live mode - stream from RPC's retention window
 * await streamer.startLive(handler, { startLedger: 1000000 });
 *
 * // 2. Archive mode - stream historical data
 * await streamer.startArchive(handler, {
 *   startLedger: 1,
 *   stopLedger: 999999
 * });
 *
 * // 3. Auto mode - seamlessly transition from archive to live
 * await streamer.start(handler, { startLedger: 1 });
 * ```
 */

export * from "@/index.ts";
export * from "@/error.ts";
export * from "@/types.ts";
