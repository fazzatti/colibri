import type {
  ClassicTransactionInput,
  createClassicTransactionPipeline,
  createInvokeContractPipeline,
  InvokeContractInput,
} from "@colibri/core";
import {
  type PipeContext,
  type PipeLevelPlugin,
  plugin,
  type PluginThis,
} from "convee";
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

type ClassicTransactionPipeline = ReturnType<
  typeof createClassicTransactionPipeline
>;
type InvokeContractPipeline = ReturnType<typeof createInvokeContractPipeline>;

type ChannelAccountsRuntimePlugin =
  & ChannelAccountsPluginControls
  & PipeLevelPlugin<
    ClassicTransactionPipeline["steps"],
    Error,
    PipeContext<ClassicTransactionPipeline["steps"]>
  >
  & PipeLevelPlugin<
    InvokeContractPipeline["steps"],
    Error,
    PipeContext<InvokeContractPipeline["steps"]>
  >;

const targetsPipeline = (
  target: ChannelAccountsPluginTarget | undefined,
  stepId: string,
): boolean =>
  target === undefined
    ? CHANNEL_ACCOUNTS_PLUGIN_TARGETS.includes(
      stepId as (typeof CHANNEL_ACCOUNTS_PLUGIN_TARGETS)[number],
    )
    : stepId === target;

const releaseChannelIfAllocated = (
  pool: ChannelAccountsPool,
  runId: string,
) => {
  if (!pool.hasAllocation(runId)) return;
  pool.release(runId);
};

/**
 * Creates a channel-accounts plugin that swaps one pooled channel into each
 * classic or Soroban invoke pipeline run.
 *
 * @param args - Plugin creation arguments
 * @returns A runtime plugin with channel registration controls
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
) => {
  const { channels, target } = args;
  const pool = new ChannelAccountsPool(channels);
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
    ): Promise<ClassicTransactionInput | InvokeContractInput> {
      const channel = await pool.allocate(this.context().runId);
      return injectChannelAccount(input, channel);
    })
    .onOutput(function (this: PluginThis, output) {
      releaseChannelIfAllocated(pool, this.context().runId);
      return output;
    })
    .onError(function (this: PluginThis, error: Error): Error {
      releaseChannelIfAllocated(pool, this.context().runId);
      return error;
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
  }) as unknown as ChannelAccountsRuntimePlugin;
};
