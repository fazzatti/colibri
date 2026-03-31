import type {
  FeeBumpPluginConfig,
  FeeBumpPluginNetworkConfig,
} from "@/types.ts";
import type { Transaction } from "stellar-sdk";

/**
 * Stable identifier used by the internal fee-bump pipeline.
 */
export const FEE_BUMP_PIPELINE_ID = "FeeBumpPipeline";

/**
 * Input accepted by the internal fee-bump pipeline.
 */
export interface FeeBumpPipelineInput {
  /** Inner transaction that will be wrapped in a fee-bump envelope. */
  transaction: Transaction;
}

/**
 * Arguments accepted by {@link createFeeBumpPipeline}.
 */
export interface CreateFeeBumpPipelineArgs {
  /** Network configuration used while building the fee-bump transaction. */
  networkConfig: FeeBumpPluginNetworkConfig;
  /** Fee-bump configuration describing the fee source and signers. */
  feeBumpConfig: FeeBumpPluginConfig;
}
