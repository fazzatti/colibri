import type { Step, StepPlugin } from "convee";
import type { CreateWorker, WorkerDefinition } from "convee/workers";
import type { ChannelAccount } from "@/shared/types.ts";

/** Worker-local account and its intentional, single executable contract. */
export interface ChannelAccountsWorkerTask<Input extends unknown[], Output> {
  /** Account loaded inside the worker; its address must match the assigned channel. */
  readonly channel: ChannelAccount;
  /**
   * Execute one request using worker-local pipelines, clients and signers.
   * @param input - Structured-cloned request arguments.
   * @returns A cloneable result, optionally asynchronously.
   * @throws Application and pipeline failures cross the worker boundary as diagnostics.
   */
  readonly run: (...input: Input) => Output | Promise<Output>;
}

/**
 * Import-safe channel worker description, created by createChannelAccountsWorker.
 * Export it as the worker module's default. Construction does not initialize an
 * account or start a worker. Attach caller plugins to the executor's step and
 * pipeline plugins inside the initializer; the address envelope is SDK-owned.
 */
export interface ChannelAccountsWorker<Input extends unknown[], Output> {
  /** Absolute worker module URL, normally supplied with import.meta.url. */
  readonly module: string;
  /** Type-only input inference; absent at runtime and never read by callers. */
  readonly __input?: Input;
  /** Type-only output inference; absent at runtime and never read by callers. */
  readonly __output?: Output;
}

/**
 * Bind the SDK-owned task through a native Convee worker declaration.
 * Use `run => worker(run, { module: import.meta.url })` with Convee's Vite
 * integration so the build tool can discover and emit the worker entry.
 *
 * @param run - Channel-bound task supplied by the SDK; do not alter its envelope.
 * @returns The native worker definition for the current application module.
 * @throws Definition errors propagate during construction. No worker is started.
 */
export type ChannelAccountsWorkerFactory<Input extends unknown[], Output> = (
  run: (request: ChannelWorkerRequest<Input>) => Promise<Output>,
) => WorkerDefinition<
  (request: ChannelWorkerRequest<Input>) => Promise<Output>
>;

/** Current account disposition in one executor, independent of on-chain status. */
export interface ChannelAccountsWorkerState {
  /** Public Stellar account address assigned to exactly one worker group. */
  readonly address: string;
  /** Quarantined accounts never receive another request from this executor. */
  readonly state: "available" | "busy" | "quarantined" | "unavailable";
  /** Failure that retired this account; absent for healthy accounts. */
  readonly error?: Error;
}

/** Configuration for a fixed set of persistent, independently owned channel workers. */
export interface CreateChannelAccountsParallelArgs<
  Input extends unknown[],
  Output,
> {
  /** Unique public account addresses. Each gets one worker; no keys are transferred. */
  readonly channels: readonly string[];
  /** Default-exported module that initializes a local account and one callable. */
  readonly worker: ChannelAccountsWorker<Input, Output>;
  /** Active plus waiting requests, default 1024; positive safe integer. */
  readonly maxPending?: number;
  /** Worker module startup deadline in milliseconds, default 10000. */
  readonly startupTimeoutMs?: number;
  /** Dispatch-to-reply deadline in milliseconds, default 30000. Timeouts quarantine. */
  readonly timeoutMs?: number;
  /** Optional Convee transport adapter for runtime permissions or build integration. */
  readonly createWorker?: CreateWorker;
  /** Native caller step identity; generated when omitted. */
  readonly id?: string;
  /** Caller plugins around the complete request, outside the worker-local pipeline. */
  readonly plugins?: StepPlugin<(...input: Input) => Output>[];
}

/**
 * Persistent channel-worker owner. Close or await-using is required for cleanup.
 * This owner never reopens or retries a transaction. After a quarantined account
 * is reconciled against the ledger, an application can create a fresh owner.
 */
export interface ChannelAccountsParallel<Input extends unknown[], Output>
  extends AsyncDisposable {
  /** Ordinary callable Convee step; argument/result inference follows the worker. */
  readonly step: Step<Input, Awaited<Output>>;
  /**
   * Preload every worker module without executing a transaction or loading signers.
   * @returns Resolves when the worker transports and modules are ready.
   * @throws Convee startup/transport errors, or CHANNEL_WORKERS_CLOSED after shutdown.
   */
  ready(): Promise<void>;
  /**
   * Inspect account dispositions without changing leases or attempting recovery.
   * @returns Fresh snapshot objects, including quarantined accounts and their errors.
   * @remarks No errors are intentionally thrown; this remains usable after close.
   */
  getChannels(): ChannelAccountsWorkerState[];
  /**
   * Stop admission, reject waiting requests, drain active work, and close workers.
   * @returns An idempotent promise fulfilled after owned transports are released.
   * @throws Convee cleanup failures; a later call cannot restart this owner.
   */
  close(): Promise<void>;
  /**
   * Immediately stop workers and quarantine accounts with outstanding work.
   * @returns Resolves after transport termination, without retrying active requests.
   * @throws Convee cleanup failures. Remote finally hooks cannot be guaranteed.
   */
  terminate(): Promise<void>;
  /**
   * Permanently dispose this owner using graceful close semantics.
   * @returns The same cleanup promise as close().
   * @throws Convee cleanup failures after all transports are asked to stop.
   */
  dispose(): Promise<void>;
  /**
   * Gracefully dispose when an await-using scope exits.
   * @returns The close promise, including when the scope throws or returns.
   * @throws Convee cleanup failures under native asynchronous disposal semantics.
   */
  [Symbol.asyncDispose](): Promise<void>;
}

/**
 * SDK-owned data envelope passed to a native worker binding.
 * Applications infer this through ChannelAccountsWorkerFactory and must forward
 * it unchanged; no live account, signer or RPC object crosses the boundary.
 * @typeParam Input - Plain-data argument tuple supplied to the executor's step.
 */
export interface ChannelWorkerRequest<Input extends unknown[]> {
  /** Assigned public account, also checked against worker-local context. */
  readonly address: string;
  /** Structured-cloned arguments for the worker-local executable. */
  readonly input: Input;
}
