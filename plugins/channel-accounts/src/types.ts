import type {
  FeeBumpConfig,
  NetworkConfig,
  SendTransactionInput,
} from "@colibri/core";
export * from "@/pipeline/types.ts";

export const PLUGIN_NAME = "ChannelAccountsPlugin";

export type ChannelAccountsPluginArgs = {
  networkConfig: NetworkConfig;
  feeBumpConfig: FeeBumpConfig;
};

export type PluginInput = SendTransactionInput;
