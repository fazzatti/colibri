/**
 * Type definitions for the Ledger Streamer variant.
 *
 * @module
 */

import type { StreamerOptions } from "@/types.ts";

/**
 * Configuration options specific to ledger streaming.
 */
export interface LedgerStreamerOptions extends StreamerOptions {
  // Ledger-specific options can be added here in the future
}

/**
 * Configuration for creating a ledger streamer.
 */
export interface LedgerStreamerConfig {
  /** URL of the Soroban RPC server for live streaming */
  rpcUrl: string;
  /** Optional URL of an archive RPC server for historical ingestion */
  archiveRpcUrl?: string;
  /** Optional configuration options */
  options?: LedgerStreamerOptions;
}
