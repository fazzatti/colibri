/**
 * Type definitions for the Ledger Streamer variant.
 *
 * @module
 */

import type {
  StreamerArchiveConfig,
  StreamerOptions,
  StreamerRpcConfig,
} from "@/types.ts";

/**
 * Configuration options specific to ledger streaming.
 */
export interface LedgerStreamerOptions extends StreamerOptions {
  // Ledger-specific options can be added here in the future
}

/**
 * Configuration for creating a ledger streamer.
 */
export type LedgerStreamerConfig = StreamerRpcConfig & StreamerArchiveConfig & {
  /** Optional configuration options */
  options?: LedgerStreamerOptions;
};
