import { plugin, type PluginThis } from "convee";
import {
  CHANNEL_ACCOUNTS_PLUGIN_ID,
  CHANNEL_ACCOUNTS_PLUGIN_TARGETS,
  type ChannelAccount,
  type ChannelAccountsPipelineInput,
  type ChannelAccountsPluginControls,
  type ChannelAccountsPluginTarget,
  type CreateChannelAccountsPluginArgs,
} from "@/shared/types.ts";
import { injectChannelAccount } from "@/plugin/helpers.ts";
import { ChannelAccountsPool } from "@/plugin/pool.ts";
import { ChannelAccountsAdmission } from "@/plugin/admission.ts";

type ChannelAccountsPublicPlugin = ChannelAccountsPluginControls & {
  readonly id: string;
  readonly target: undefined;
  supports(capability: string): boolean;
  targets(stepId: string): boolean;
  input<TInput extends ChannelAccountsPipelineInput>(
    input: TInput,
  ): Promise<TInput>;
  finally(): void | Promise<void>;
};

const targetsPipeline = (
  target: ChannelAccountsPluginTarget | undefined,
  stepId: string,
): boolean =>
  target === undefined
    ? CHANNEL_ACCOUNTS_PLUGIN_TARGETS.includes(
      stepId as (typeof CHANNEL_ACCOUNTS_PLUGIN_TARGETS)[number],
    )
    : stepId === target;

/**
 * Creates a channel-accounts plugin that swaps one pooled channel into each
 * classic or Soroban invoke pipeline run.
 * Releases the channel during finalization, including when another plugin's
 * input, output, or error hook fails. Runs that never acquired a channel need
 * no cleanup. Convee schedules admission across all pipelines sharing this
 * plugin. An optional concurrency cap is independent of the dynamically
 * registered channel count; maxPending bounds admitted plus queued runs.
 * Omitted limits preserve open admission, with one active run per account.
 *
 * @param args - Initial channels, optional pipeline target and positive integer
 * admission limits. Signers and clients remain in the calling runtime.
 * @returns A plugin for existing pipelines, with dynamic registration controls.
 * Its input hook copies the input/config containers and preserves nested values;
 * its finally hook releases the account and admission slot, asynchronously when
 * a slot was requested.
 * @throws Convee ConcurrencyError with CNC_CONFIG during construction for invalid
 * limits, or CNC_CAPACITY from the input hook when maxPending is full. Like other
 * input-hook failures, admission errors reject the pipeline call directly;
 * body-error recovery hooks do not run. Original pipeline and plugin failures
 * retain their normal behavior.
 *
 * @example
 * ```typescript
 * const plugin = createChannelAccountsPlugin({ channels });
 * const pipeline = createClassicTransactionPipeline({ networkConfig });
 * pipeline.use(plugin);
 * ```
 */
export const createChannelAccountsPlugin = (
  args: CreateChannelAccountsPluginArgs = {},
): ChannelAccountsPublicPlugin => {
  const { channels, target } = args;
  const pool = new ChannelAccountsPool(channels);
  const admission = new ChannelAccountsAdmission(pool, args);
  const controls: ChannelAccountsPluginControls = {
    registerChannels(channels: readonly ChannelAccount[]) {
      pool.registerChannels(channels);
    },
    getChannels(): ChannelAccount[] {
      return pool.getChannels();
    },
  };

  const channelAccountsPlugin = plugin({
    id: CHANNEL_ACCOUNTS_PLUGIN_ID,
    ...(target === undefined ? {} : { target }),
  })
    .onInput(async function (
      this: PluginThis,
      input: ChannelAccountsPipelineInput,
    ): Promise<ChannelAccountsPipelineInput> {
      const channel = await admission.acquire(this.context().runId);
      return injectChannelAccount(input, channel);
    })
    .onFinally(function (this: PluginThis) {
      return admission.release(this.context().runId);
    });

  return new Proxy(channelAccountsPlugin, {
    get(runtime, prop, receiver) {
      if (prop === "targets") {
        return (stepId: string) => targetsPipeline(target, stepId);
      }

      if (prop in controls) {
        return Reflect.get(controls, prop, receiver);
      }

      return Reflect.get(runtime, prop, receiver);
    },
    has(runtime, prop) {
      return prop === "targets" || prop in controls || prop in runtime;
    },
  }) as unknown as ChannelAccountsPublicPlugin;
};
