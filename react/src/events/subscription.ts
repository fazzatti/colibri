"use client";
// @deno-types="@types/react"
import { useSyncExternalStore } from "react";

import type { Event, EventFilter } from "@colibri/core/events";
import type { LiveStartOptions, StreamerOptions } from "@colibri/rpc-streamer";
import type { ColibriConfig } from "@/context/config.ts";
import { useColibriConfig } from "@/context/provider.ts";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";
/** Observable contract-event window; event history remains RPC-retention bounded. */
export interface ContractEventsState {
  /** Subscription lifecycle. */
  status: "idle" | "streaming" | "complete" | "error";
  /** Most recent events, bounded by maxEvents. */
  events: readonly Event[];
  /** Last streamer failure; no silent restarts after a terminal error. */
  error?: unknown;
}
/** Live event subscription configuration. */
export interface ContractEventsOptions {
  /** Core event filters. */
  filters?: EventFilter[];
  /** Optional inclusive starting ledger; otherwise starts at the latest ledger. */
  startLedger?: number;
  /** Optional ending ledger. */
  stopLedger?: number;
  /** Maximum retained events; defaults to 100. */
  maxEvents?: number;
  /** Existing RPCStreamer pacing controls. */
  streaming?: StreamerOptions;
}
const idle: ContractEventsState = Object.freeze({
  status: "idle",
  events: Object.freeze([]),
});
/** Shared subscription; starts with the first observer and stops after the last unsubscribes. */
export class ContractEventsSubscription {
  private state: ContractEventsState = idle;
  private listeners = new Set<() => void>();
  private abort?: AbortController;
  private generation = 0;
  private readonly maxEvents: number;
  /** Construct without making requests. Keep one instance for observers that should share a stream. */
  constructor(
    readonly config: ColibriConfig,
    private readonly options: ContractEventsOptions = {},
  ) {
    this.maxEvents = options.maxEvents ?? 100;
    if (!Number.isSafeInteger(this.maxEvents) || this.maxEvents < 1) {
      throw new ColibriReactError(
        ReactCode.INVALID_CONFIG,
        "maxEvents must be a positive safe integer",
      );
    }
  }
  /** Stable event-window snapshot. */
  getSnapshot = (): ContractEventsState => this.state;
  /** SSR never starts streaming. */
  getServerSnapshot = (): ContractEventsState => idle;
  /** @internal */
  private set(state: ContractEventsState): void {
    this.state = Object.freeze(state);
    this.listeners.forEach((fn) => fn());
  }
  /** Subscribe; the last cleanup cancels waits and ignores late responses. */
  subscribe = (listener: () => void): () => void => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.stop();
    };
  };
  /** @internal */
  private start(): void {
    const generation = ++this.generation;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.set({ status: "streaming", events: this.state.events });
    const run = async () => {
      const { RPCStreamer } = await import("@colibri/rpc-streamer");
      if (signal.aborted) return;
      const streamer = RPCStreamer.event({
        networkConfig: this.config.network,
        filters: this.options.filters,
        options: this.options.streaming,
      });
      const start: LiveStartOptions = {
        startLedger: this.options.startLedger,
        stopLedger: this.options.stopLedger,
        signal,
      };
      await streamer.startLive((event) => {
        if (generation !== this.generation) return;
        if (this.state.events.some((previous) => previous.id === event.id)) {
          return;
        }
        this.set({
          status: "streaming",
          events: Object.freeze(
            [...this.state.events, event].slice(-this.maxEvents),
          ),
        });
      }, start);
      if (generation === this.generation) {
        this.set({ ...this.state, status: "complete" });
      }
    };
    void run().catch((error) => {
      if (generation === this.generation) {
        this.set({ ...this.state, status: "error", error });
      }
    });
  }
  /** @internal */
  private stop(): void {
    ++this.generation;
    this.abort?.abort();
    this.abort = undefined;
    this.set({ ...this.state, status: "idle" });
  }
  /** Explicitly retry a terminal failure. Replays the configured ledger range and deduplicates the retained window. */
  restart(): void {
    this.stop();
    if (this.listeners.size) this.start();
  }
  /** Stop observing and release callbacks. In-flight RPC calls may finish. */
  destroy(): void {
    this.listeners.clear();
    this.stop();
  }
}
/** Construct an application-owned, shared event subscription. */
export function createContractEvents(
  config: ColibriConfig,
  options: ContractEventsOptions = {},
): ContractEventsSubscription {
  return new ContractEventsSubscription(config, options);
}
/** Observe an existing subscription. Multiple components share its underlying streamer. */
export function useContractEvents(
  subscription: ContractEventsSubscription,
): ContractEventsState {
  if (useColibriConfig() !== subscription.config) {
    throw new ColibriReactError(
      ReactCode.INVALID_CONFIG,
      "Event subscription belongs to another provider",
    );
  }
  return useSyncExternalStore(
    subscription.subscribe,
    subscription.getSnapshot,
    subscription.getServerSnapshot,
  );
}
