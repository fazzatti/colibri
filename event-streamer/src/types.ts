import type {
  FeeBumpConfig,
  NetworkConfig,
  SendTransactionInput,
} from "@colibri/core";
export * from "@/pipeline/types.ts";

export const PLUGIN_NAME = "FeeBumpPlugin";

export type FeeBumpPluginArgs = {
  networkConfig: NetworkConfig;
  feeBumpConfig: FeeBumpConfig;
};

export type PluginInput = SendTransactionInput;
