/**
 * @module @colibri/plugin-channel-accounts
 *
 * Sponsored channel-account utilities and pipeline plugin for Colibri.
 */

export {
  createChannelAccountsPlugin,
  CHANNEL_ACCOUNTS_PLUGIN_ID,
  CHANNEL_ACCOUNTS_PLUGIN_TARGETS,
  MAX_CHANNELS_PER_TRANSACTION,
} from "@/index.ts";
export { ChannelAccounts } from "@/tools/channel-accounts.ts";
export {
  Code,
  ERROR_PLG_CHA,
} from "@/shared/error.ts";
