/**
 * @module @colibri/plugin-channel-accounts
 *
 * Sponsored channel-account utilities and pipeline plugin for Colibri.
 */

export {
  CHANNEL_ACCOUNTS_PLUGIN_ID,
  CHANNEL_ACCOUNTS_PLUGIN_TARGETS,
  createChannelAccountsPlugin,
  MAX_CHANNELS_PER_TRANSACTION,
} from "@/index.ts";
export { ChannelAccounts } from "@/tools/channel-accounts.ts";
export type {
  ChannelAccount,
  ChannelAccountsPipelineInput,
} from "@/shared/types.ts";
export { createChannelAccountsConcurrent } from "@/concurrency/index.ts";
export type { CreateChannelAccountsConcurrentArgs } from "@/concurrency/index.ts";
export {
  createChannelAccountsParallel,
  createChannelAccountsWorker,
} from "@/workers/index.ts";
export type {
  ChannelAccountsParallel,
  ChannelAccountsWorker,
  ChannelAccountsWorkerFactory,
  ChannelAccountsWorkerState,
  ChannelAccountsWorkerTask,
  ChannelWorkerRequest,
  CreateChannelAccountsParallelArgs,
} from "@/workers/index.ts";
export { Code, ERROR_PLG_CHA } from "@/shared/error.ts";
