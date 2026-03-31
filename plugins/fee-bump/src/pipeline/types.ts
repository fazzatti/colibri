import type { FeeBumpConfig, NetworkConfig } from "@colibri/core";
import type { Transaction } from "stellar-sdk";

export const FEE_BUMP_PIPELINE_ID = "FeeBumpPipeline";

export type FeeBumpPipelineInput = {
  transaction: Transaction;
};
export type CreateFeeBumpPipelineArgs = {
  networkConfig: NetworkConfig;
  feeBumpConfig: FeeBumpConfig;
};
