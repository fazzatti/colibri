import { plugin, type PluginThis, step } from "convee";
import { persistentParallel, WorkerError } from "convee/workers";
import { StrKey } from "@colibri/core";
import * as ERROR from "@/shared/error.ts";
import {
  CHANNEL_WORKER_CONTEXT,
  channelWorkerDefinition,
} from "@/workers/definition.ts";
import { ChannelWorkerLeases } from "@/workers/leases.ts";
import type {
  ChannelAccountsParallel,
  CreateChannelAccountsParallelArgs,
} from "@/workers/types.ts";

interface Request<Input extends unknown[]> {
  readonly id: string;
  readonly input: Input;
  channel?: string;
  failure?: Error;
  quarantined?: boolean;
}

const safeBeforeDispatch = new Set([
  "WRK_CONFIG",
  "WRK_CLOSED",
  "WRK_CAPACITY",
  "WRK_STARTUP",
  "WRK_UNAVAILABLE",
]);

const validateOptions = (
  channels: readonly string[],
  maxPending: number,
): void => {
  if (
    !Array.isArray(channels) || channels.length === 0 ||
    channels.some((address) => !StrKey.isValidEd25519PublicKey(address))
  ) {
    throw new ERROR.INVALID_WORKER_CONFIGURATION(
      "channels",
      "Provide at least one valid Stellar public account address.",
    );
  }
  if (new Set(channels).size !== channels.length) {
    throw new ERROR.INVALID_WORKER_CONFIGURATION(
      "channels",
      "Each channel address must have exactly one owner in this executor.",
    );
  }
  if (!Number.isSafeInteger(maxPending) || maxPending < 1) {
    throw new ERROR.INVALID_WORKER_CONFIGURATION(
      "maxPending",
      "Provide a positive safe integer.",
    );
  }
};

/**
 * Create a persistent executor with one worker and one account lease per channel.
 * Requests queue in arrival order and use the next available healthy account.
 * The worker initializes its own signers and pipeline. Inputs/results cross a
 * structured-clone boundary; existing plugin users can retain the local path.
 *
 * @typeParam Input - Exact request arguments inferred from the worker definition.
 * @typeParam Output - Worker result returned by the ordinary callable step.
 * @param args - Unique public addresses, worker definition, deadlines and caller plugins.
 * @returns An explicit owner with step, ready, close, termination and inspection controls.
 * @throws INVALID_WORKER_CONFIGURATION for invalid addresses/capacity/definition,
 * or Convee WRK_CONFIG for invalid transport settings. Requests may fail with
 * INVALID_WORKER_PAYLOAD, CHANNEL_WORKER_CAPACITY, CHANNELS_UNAVAILABLE,
 * CHANNEL_WORKERS_CLOSED or CHANNEL_WORKER_FAILED. Execution failures quarantine
 * their account before caller error recovery. No transaction is retried, and
 * shutdown never reopens the owner. Use close() or await using for cleanup.
 */
export const createChannelAccountsParallel = <Input extends unknown[], Output>(
  args: CreateChannelAccountsParallelArgs<Input, Output>,
): ChannelAccountsParallel<Input, Output> => {
  if (!args) {
    throw new ERROR.INVALID_WORKER_CONFIGURATION(
      "args",
      "Provide channels and a worker definition.",
    );
  }
  const { maxPending = 1024 } = args;
  validateOptions(args.channels, maxPending);
  const definition = channelWorkerDefinition(args.worker);
  const leases = new ChannelWorkerLeases(args.channels, maxPending);
  let interrupted = false;
  const workers = Object.fromEntries(args.channels.map((address) => [address, {
    worker: definition,
    count: 1,
    maxRestarts: 0,
    startupTimeoutMs: args.startupTimeoutMs,
    timeoutMs: args.timeoutMs,
  }]));
  const ownership = plugin({ id: "ChannelWorkerOwnership" })
    .onInput(async (request: Request<Input>) => {
      request.channel = await leases.acquire(request.id);
      return request;
    })
    .onError((error: Error, [request]: [Request<Input>]) => {
      const quarantined = interrupted ||
        !(error instanceof WorkerError && safeBeforeDispatch.has(error.code));
      const failure = new ERROR.CHANNEL_WORKER_FAILED(
        request.channel!,
        error,
        quarantined,
      );
      request.quarantined = quarantined;
      if (
        quarantined ||
        (error instanceof WorkerError &&
          (error.code === "WRK_STARTUP" || error.code === "WRK_UNAVAILABLE"))
      ) request.failure = failure;
      return failure;
    })
    .onFinally(function (this: PluginThis) {
      const [request] = this.context().step.current().input as [Request<Input>];
      leases.release(request.id, request.failure, request.quarantined);
    });
  const owner = persistentParallel({
    workers,
    maxPending,
    createWorker: args.createWorker,
    mode: "collect",
    plugins: [ownership],
    split: (builders, request: Request<Input>) =>
      [
        builders[request.channel!].job({
          address: request.channel!,
          input: request.input,
        }).withContext({
          seed: { [CHANNEL_WORKER_CONTEXT]: request.channel },
        }),
      ] as const,
    join: ([outcome]) => {
      if (outcome.status === "rejected") throw outcome.error;
      return outcome.value;
    },
  });
  const execute = step<Input, Output>(
    async function (...input: Input): Promise<Output> {
      leases.assertOpen();
      let snapshot: Input;
      try {
        snapshot = structuredClone(input);
      } catch (cause) {
        throw new ERROR.INVALID_WORKER_PAYLOAD(cause as Error);
      }
      return await owner.step.runWith({
        context: { parent: this.context() },
      }, { id: crypto.randomUUID(), input: snapshot });
    },
    { id: args.id, plugins: args.plugins },
  );
  const close = (): Promise<void> => {
    leases.close();
    return owner.close();
  };
  return Object.freeze({
    step: execute,
    getChannels: () => leases.snapshot(),
    async ready() {
      leases.assertOpen();
      await owner.ready();
    },
    close,
    dispose: close,
    [Symbol.asyncDispose]: close,
    terminate() {
      interrupted = true;
      leases.interrupt();
      return owner.terminate();
    },
  });
};
