import type { Server as StellarServer } from "stellar-sdk/rpc";
import type {
  Event as CoreEvent,
  EventFilter as CoreEventFilter,
  Ledger as CoreLedger,
  NetworkConfig as CoreNetworkConfig,
} from "@colibri/core";

/** @internal Exact SDK client type, without exporting the SDK namespace. */
export type Server = StellarServer;
/** @internal Exact Core event type. */
export type Event = CoreEvent;
/** @internal Exact Core filter type. */
export type EventFilter = CoreEventFilter;
/** @internal Exact Core ledger type. */
export type Ledger = CoreLedger;
/** @internal Exact Core network configuration type. */
export type NetworkConfig = CoreNetworkConfig;
