import type {
  FeeBumpConfig,
  NetworkConfig,
  SendTransactionInput,
} from "@colibri/core";
import { steps } from "@colibri/core";
export * from "@/pipeline/types.ts";

export const FEE_BUMP_PLUGIN_ID = "FeeBumpPlugin";
export const FEE_BUMP_PLUGIN_TARGET = steps.SEND_TRANSACTION_STEP_ID;

export type FeeBumpPluginArgs = {
  networkConfig: NetworkConfig;
  feeBumpConfig: FeeBumpConfig;
};

export type PluginInput = SendTransactionInput;
