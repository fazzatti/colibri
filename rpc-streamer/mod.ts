/**
 * @module @colibri/rpc-streamer
 *
 * Generic RPC streaming framework for Stellar blockchain data.
 *
 * This module provides a unified streaming architecture that eliminates code duplication
 * across different RPC data sources. It uses a composition-based design where:
 *
 * - **`RPCStreamer<T>`** is the core generic class handling all control flow
 * - **Factory functions** create pre-configured streamers for specific data types
 * - **Static methods** provide convenient access to pre-built variants
 *
 * ## Features
 *
 * - **Callback-based API**: Familiar `onEvent`/`onLedger` handler pattern
 * - **Composable design**: Easily create custom streamers for new RPC endpoints
 * - **Static factories**: `RPCStreamer.event()` and `RPCStreamer.ledger()`
 * - **Unified errors**: Consistent error codes across all variants
 * - **Archive support**: Seamless historical data ingestion
 *
 * ## Quick Start
 *
 * ```ts
 * import { RPCStreamer } from "@colibri/rpc-streamer";
 * import { EventFilter } from "@colibri/core";
 *
 * // Create an event streamer
 * const eventStreamer = RPCStreamer.event({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   filters: [new EventFilter({ contractId: "C..." })],
 * });
 *
 * await eventStreamer.start(async (event) => {
 *   console.log("Event:", event.id);
 * }, { startLedger: 1000000 });
 * ```
 *
 * @example Ledger streaming
 * ```ts
 * import { RPCStreamer } from "@colibri/rpc-streamer";
 *
 * const ledgerStreamer = RPCStreamer.ledger({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   archiveRpcUrl: "https://archive-rpc.example.com",
 * });
 *
 * await ledgerStreamer.start(async (ledger) => {
 *   console.log(`Ledger ${ledger.sequence}: ${ledger.transactionCount} txs`);
 * }, { startLedger: 1000000 });
 * ```
 *
 * @example Custom streamer
 * ```ts
 * import { RPCStreamer } from "@colibri/rpc-streamer";
 *
 * const customStreamer = new RPCStreamer<MyType>({
 *   rpcUrl: "https://my-rpc.example.com",
 *   ingestLive: async (rpc, ledger, handler, stopLedger) => {
 *     // Custom live ingestion logic
 *     return { nextLedger: ledger + 1, shouldWait: true, hitStopLedger: false };
 *   },
 *   ingestArchive: async (rpc, start, stop, handler, context) => {
 *     // Custom archive ingestion logic
 *     return stop + 1;
 *   },
 * });
 * ```
 */

// Core streamer
export { RPCStreamer } from "@/streamer.ts";

// Types
export type {
  DataHandler,
  CheckpointHandler,
  ErrorHandler,
  LiveIngestionResult,
  LiveIngestFunc,
  ArchiveIngestFunc,
  ArchiveIngestContext,
  StreamerOptions,
  BaseStartOptions,
  LiveStartOptions,
  ArchiveStartOptions,
  AutoStartOptions,
  RPCStreamerConfig,
} from "@/types.ts";

// Errors
export { RPCStreamerError, RPCStreamerErrorCode } from "@/errors.ts";

// Event streamer factory
export { createEventStreamer } from "@/variants/event/index.ts";
export type {
  EventStreamerConfig,
  EventStreamerOptions,
} from "@/variants/event/types.ts";

// Ledger streamer factory
export { createLedgerStreamer } from "@/variants/ledger/index.ts";
export type {
  LedgerStreamerConfig,
  LedgerStreamerOptions,
} from "@/variants/ledger/types.ts";
