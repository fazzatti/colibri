/**
 * Type definitions for the Event Streamer variant.
 *
 * @module
 */

import type { EventFilter } from "@/native-types.ts";
import type {
  StreamerArchiveConfig,
  StreamerOptions,
  StreamerRpcConfig,
} from "@/types.ts";

/**
 * Configuration options specific to event streaming.
 */
export interface EventStreamerOptions extends StreamerOptions {
  // Event-specific options can be added here in the future
}

/**
 * Configuration for creating an event streamer.
 */
export type EventStreamerConfig = StreamerRpcConfig & StreamerArchiveConfig & {
  /** Event filters to apply when fetching events */
  filters?: EventFilter[];
  /** Optional configuration options */
  options?: EventStreamerOptions;
};
