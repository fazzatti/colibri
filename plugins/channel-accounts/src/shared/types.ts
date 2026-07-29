import {
  CLASSIC_TRANSACTION_PIPELINE_ID,
  INVOKE_CONTRACT_PIPELINE_ID,
} from "@colibri/core";
import type {
  ClassicTransactionInput,
  ClassicTransactionOutput,
  InvokeContractInput,
  InvokeContractOutput,
  NativeAccount,
  NetworkConfig,
  TransactionConfig,
  WithSigner,
} from "@colibri/core";
import type { Server } from "stellar-sdk/rpc";

/**
 * Stable plugin id used when attaching the channel-accounts plugin to a pipe.
 */
export const CHANNEL_ACCOUNTS_PLUGIN_ID = "ChannelAccountsPlugin";

/**
 * Valid pipeline ids supported by the channel-accounts plugin.
 */
export type ChannelAccountsPluginTarget =
  | typeof CLASSIC_TRANSACTION_PIPELINE_ID
  | typeof INVOKE_CONTRACT_PIPELINE_ID;

/**
 * All pipeline ids supported by the channel-accounts plugin when no explicit target is supplied.
 */
export const CHANNEL_ACCOUNTS_PLUGIN_TARGETS = [
  CLASSIC_TRANSACTION_PIPELINE_ID,
  INVOKE_CONTRACT_PIPELINE_ID,
] as const satisfies readonly ChannelAccountsPluginTarget[];

/**
 * Maximum number of channel accounts handled in a single setup or close transaction batch.
 */
export const MAX_CHANNELS_PER_TRANSACTION = 15;

/**
 * A native Stellar account paired with a signer and used as a reusable channel account.
 */
export type ChannelAccount = WithSigner<NativeAccount>;

/**
 * Arguments for creating the channel-accounts pipeline plugin.
 */
export type CreateChannelAccountsPluginArgs = {
  /**
   * Initial channels to register in the plugin pool.
   */
  channels?: readonly ChannelAccount[];

  /**
   * Optional explicit pipeline target. When omitted, the plugin can attach to
   * both classic and Soroban invoke pipelines.
   */
  target?: ChannelAccountsPluginTarget;
};

/**
 * Input shapes accepted by the supported pipelines.
 */
export type ChannelAccountsPipelineInput =
  | ClassicTransactionInput
  | InvokeContractInput;

/**
 * Output shapes returned by the supported pipelines.
 */
export type ChannelAccountsPipelineOutput =
  | ClassicTransactionOutput
  | InvokeContractOutput;

/**
 * Extra controls exposed by the runtime plugin proxy.
 */
export type ChannelAccountsPluginControls = {
  /**
   * Adds one or more channels to the plugin pool.
   */
  registerChannels(channels: readonly ChannelAccount[]): void;

  /**
   * Returns both free and currently allocated channels known to the plugin pool.
   */
  getChannels(): ChannelAccount[];
};

/**
 * Arguments for opening new channel accounts.
 */
export type OpenChannelsArgs = {
  numberOfChannels: number;
  sponsor: ChannelAccount;
  setSponsorAsSigner?: boolean;
  networkConfig: NetworkConfig;
  config: TransactionConfig;
  rpc?: Server;
};

/**
 * Arguments for closing and merging channel accounts back into the sponsor.
 */
export type CloseChannelsArgs = {
  channels: readonly ChannelAccount[];
  sponsor: ChannelAccount;
  networkConfig: NetworkConfig;
  config: TransactionConfig;
  rpc?: Server;
};
