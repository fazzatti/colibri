import type { FeeBumpConfig, NetworkConfig } from "@colibri/core";
import type { Transaction } from "stellar-sdk";

export const PIPELINE_NAME = "FeeBumpPipeline";

export type FeeBumpPipelineInput = {
  transaction: Transaction;
};
export type CreateFeeBumpPipelineArgs = {
  networkConfig: NetworkConfig;
  feeBumpConfig: FeeBumpConfig;
};
