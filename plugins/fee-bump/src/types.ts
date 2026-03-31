import type {
  FeeBumpConfig,
  NetworkConfig,
  SendTransactionInput,
} from "@colibri/core";
export * from "@/pipeline/types.ts";

/**
 * Stable identifier used by the fee-bump plugin.
 */
export const FEE_BUMP_PLUGIN_ID = "FeeBumpPlugin";

/**
 * Pipeline target id handled by the fee-bump plugin.
 */
export const FEE_BUMP_PLUGIN_TARGET = "send-transaction";

/**
 * Arguments accepted by {@link createFeeBumpPlugin}.
 */
export interface FeeBumpPluginArgs {
  /** Network configuration used to build the fee-bump envelope. */
  networkConfig: NetworkConfig;
  /** Fee-bump configuration describing the fee payer and signers. */
  feeBumpConfig: FeeBumpConfig;
}

/**
 * Input shape intercepted by the fee-bump plugin.
 */
export type PluginInput = SendTransactionInput;
