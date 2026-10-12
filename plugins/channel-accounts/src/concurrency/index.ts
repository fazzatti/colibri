import { concurrent, type ConcurrentStep, step, type StepPlugin } from "convee";
import { ChannelAccountsPool } from "@/plugin/pool.ts";
import { injectChannelAccount } from "@/plugin/helpers.ts";
import type {
  ChannelAccount,
  ChannelAccountsPipelineInput,
} from "@/shared/types.ts";
import * as ERROR from "@/shared/error.ts";

/** Configuration for bounded, local transaction execution using a fixed account set. */
export interface CreateChannelAccountsConcurrentArgs<
  Input extends ChannelAccountsPipelineInput,
  Output,
> {
  /** Actual accounts/signers retained by reference; duplicate addresses count once. */
  readonly channels: readonly ChannelAccount[];
  /**
   * Existing native pipeline or function, executed after channel injection.
   * @param input - Original pipeline input with the leased source and channel signer.
   * @returns Its original result, optionally asynchronously; object identity is retained.
   * @throws Original local errors after actual pipeline finalization has completed.
   */
  readonly run: (input: Input) => Output | Promise<Output>;
  /** Active plus queued requests, default 1024; validated by Convee. */
  readonly maxPending?: number;
  /** Optional cooperative deadline in milliseconds; active work is drained, never killed. */
  readonly timeoutMs?: number;
  /** Native caller step identity; generated when omitted. */
  readonly id?: string;
  /** Outer caller plugins; inner pipeline plugins continue using their original lifecycle. */
  readonly plugins?: StepPlugin<(input: Input) => Output>[];
}

/**
 * Schedule complete channel-backed pipeline runs locally through Convee.
 * Each distinct account provides one shared execution slot across all calls.
 * The input/config containers are copied for injection; signers, RPC closures
 * and results keep their identities. A lease remains held through the native
 * pipeline's output, error and finally hooks. Existing dynamic-registration
 * users can continue using createChannelAccountsPlugin without this wrapper.
 *
 * @typeParam Input - Existing classic or invoke pipeline input, including extra fields.
 * @typeParam Output - Unmodified result inferred from run.
 * @param args - Fixed channel set, existing pipeline/function and optional admission/deadline settings.
 * @returns A normal callable concurrent step with runWith, use and remove. No close is needed.
 * @throws INVALID_CHANNEL_CONFIGURATION for an empty account set or non-callable run;
 * Convee configuration/admission/cancellation errors and original pipeline failures
 * surface through the normal outer lifecycle. Cancellation stops queued work but
 * waits for active calls to finish before releasing their accounts. Nothing is retried.
 */
export const createChannelAccountsConcurrent = <
  Input extends ChannelAccountsPipelineInput,
  Output,
>(
  args: CreateChannelAccountsConcurrentArgs<Input, Output>,
): ConcurrentStep<[Input], Output> => {
  if (
    !args || !Array.isArray(args.channels) || !args.channels.length ||
    typeof args.run !== "function"
  ) {
    throw new ERROR.INVALID_CHANNEL_CONFIGURATION();
  }
  const pool = new ChannelAccountsPool(args.channels);
  const run = args.run;
  const transaction = step<[Input], Output>(async function (input) {
    const id = crypto.randomUUID();
    const channel = await pool.allocate(id);
    try {
      const injected = injectChannelAccount(input, channel);
      const runWith: unknown = Reflect.get(run, "runWith");
      if (typeof runWith === "function") {
        return await Reflect.apply(runWith, run, [{
          context: { parent: this.context() },
        }, injected]) as Output;
      }
      return await run(injected);
    } finally {
      pool.release(id);
    }
  });
  return concurrent({
    tasks: { transaction },
    concurrency: pool.getChannels().length,
    capacityScope: "shared",
    maxPending: args.maxPending,
    timeoutMs: args.timeoutMs,
    id: args.id,
    plugins: args.plugins,
    mode: "collect",
    split: ({ transaction }, input: Input) => [transaction.job(input)] as const,
    join: ([outcome]) => {
      if (outcome.status === "rejected") throw outcome.error;
      return outcome.value;
    },
  });
};
