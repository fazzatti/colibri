import type { StepThis } from "convee";
import { worker, type WorkerDefinition } from "convee/workers";
import * as ERROR from "@/shared/error.ts";
import type {
  ChannelAccountsWorker,
  ChannelAccountsWorkerFactory,
  ChannelAccountsWorkerTask,
  ChannelWorkerRequest,
} from "@/workers/types.ts";

export const CHANNEL_WORKER_CONTEXT = "@colibri/channel-account";
const definitions = new WeakSet<object>();

/** Validate the opaque factory result without relying on Convee's private internals. */
export const channelWorkerDefinition = <Input extends unknown[], Output>(
  definition: ChannelAccountsWorker<Input, Output>,
): WorkerDefinition<
  (request: ChannelWorkerRequest<Input>) => Promise<Output>
> => {
  if (!definitions.has(definition)) {
    throw new ERROR.INVALID_WORKER_CONFIGURATION(
      "worker",
      "Use createChannelAccountsWorker from this package instance.",
    );
  }
  return definition as unknown as WorkerDefinition<
    (request: ChannelWorkerRequest<Input>) => Promise<Output>
  >;
};

/** Bind one lazy worker-local task and preserve its initialization result. */
export const createChannelWorkerTask = <Input extends unknown[], Output>(
  initialize: (
    address: string,
  ) =>
    | ChannelAccountsWorkerTask<Input, Output>
    | Promise<ChannelAccountsWorkerTask<Input, Output>>,
): (
  this: StepThis,
  request: ChannelWorkerRequest<Input>,
) => Promise<Output> => {
  let address: string | undefined;
  let initialized:
    | Promise<ChannelAccountsWorkerTask<Input, Output>>
    | undefined;
  return async function (this: StepThis, request: ChannelWorkerRequest<Input>) {
    const assigned = this.context().state.get(CHANNEL_WORKER_CONTEXT);
    if (
      assigned !== request.address ||
      (address !== undefined && address !== assigned)
    ) {
      throw new ERROR.CHANNEL_BINDING_MISMATCH(
        String(assigned),
        request.address,
      );
    }
    address = request.address;
    initialized ??= Promise.resolve().then(async () => {
      const task = await initialize(request.address);
      if (task.channel.address() !== request.address) {
        throw new ERROR.CHANNEL_BINDING_MISMATCH(
          request.address,
          task.channel.address(),
        );
      }
      if (typeof task.run !== "function") {
        throw new ERROR.INVALID_WORKER_CONFIGURATION(
          "run",
          "The worker initializer must return a callable run function.",
        );
      }
      return task;
    });
    const task = await initialized;
    const runWith: unknown = Reflect.get(task.run, "runWith");
    if (typeof runWith === "function") {
      return await Reflect.apply(runWith, task.run, [{
        context: { parent: this.context() },
      }, ...request.input]) as Awaited<Output>;
    }
    return await task.run(...request.input);
  };
};

/**
 * Define one import-safe worker that loads its account and executable lazily.
 * Export the result as the module's default. The initializer runs once per
 * worker, on its first assigned request, and must return the matching account.
 * Attach createChannelAccountsPlugin to the local pipeline inside initialize.
 * No signer, client, function or native SDK object is sent from the caller.
 *
 * @typeParam Input - Plain-data request tuple inferred from the returned run function.
 * @typeParam Output - Cloneable result inferred from that function.
 * @param initialize - Loads the assigned account and creates one worker-local callable.
 * @param binding - Absolute module URL, or `run => worker(run, { module: import.meta.url })`
 * for build tools that discover native Convee declarations. The binding must not
 * attach hooks to the SDK-owned envelope; attach caller hooks to the executor step.
 * @returns An opaque definition for createChannelAccountsParallel; importing it is inert.
 * @throws INVALID_WORKER_CONFIGURATION for invalid construction arguments.
 * Initializer, binding and execution failures surface later through the executor;
 * failed initialization is retained and never retried in the same worker.
 * Errors thrown by a custom binding propagate during construction.
 */
export const createChannelAccountsWorker = <Input extends unknown[], Output>(
  initialize: (
    address: string,
  ) =>
    | ChannelAccountsWorkerTask<Input, Output>
    | Promise<ChannelAccountsWorkerTask<Input, Output>>,
  binding:
    | { readonly module: string | URL }
    | ChannelAccountsWorkerFactory<Input, Output>,
): ChannelAccountsWorker<Input, Output> => {
  if (typeof initialize !== "function") {
    throw new ERROR.INVALID_WORKER_CONFIGURATION(
      "initialize",
      "Provide an account initializer returning { channel, run }.",
    );
  }
  const task = createChannelWorkerTask(initialize);
  let definition: WorkerDefinition<typeof task>;
  if (typeof binding === "function") {
    definition = binding(task);
  } else {
    let module: string;
    try {
      module = new URL(binding.module).href;
    } catch {
      throw new ERROR.INVALID_WORKER_CONFIGURATION(
        "module",
        "Provide an absolute worker module URL.",
      );
    }
    definition = worker(task, { module });
  }
  definitions.add(definition);
  return definition as unknown as ChannelAccountsWorker<Input, Output>;
};
