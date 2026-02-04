/**
 * Type definitions for the Event Streamer variant.
 *
 * @module
 */

import type { EventFilter } from "@colibri/core";
import type { StreamerOptions } from "@/types.ts";

/**
 * Configuration options specific to event streaming.
 */
export interface EventStreamerOptions extends StreamerOptions {
  // Event-specific options can be added here in the future
}

/**
 * Configuration for creating an event streamer.
 */
export interface EventStreamerConfig {
  /** URL of the Soroban RPC server for live streaming */
  rpcUrl: string;
  /** Optional URL of an archive RPC server for historical ingestion */
  archiveRpcUrl?: string;
  /** Event filters to apply when fetching events */
  filters?: EventFilter[];
  /** Optional configuration options */
  options?: EventStreamerOptions;
}
