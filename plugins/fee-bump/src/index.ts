import { plugin } from "convee";
import {
  FEE_BUMP_PLUGIN_ID,
  FEE_BUMP_PLUGIN_TARGET,
  type FeeBumpPluginArgs,
  type PluginInput,
} from "@/types.ts";
import { createFeeBumpPipeline } from "@/pipeline/pipeline.ts";
import { assert, isTransaction } from "@colibri/core";
import * as E from "@/error.ts";

export const createFeeBumpPlugin = ({
  networkConfig,
  feeBumpConfig,
}: FeeBumpPluginArgs) => {
  const wrapperPipeline = createFeeBumpPipeline({
    networkConfig,
    feeBumpConfig,
  });

  const feeBumpPlugin = plugin({
    id: FEE_BUMP_PLUGIN_ID,
    target: FEE_BUMP_PLUGIN_TARGET,
  }).onInput(async (input: PluginInput): Promise<PluginInput> => {
    const { transaction } = input;

    assert(isTransaction(transaction), new E.NOT_A_TRANSACTION(transaction));

    const feeBumpTransaction = await wrapperPipeline({ transaction });

    return { ...input, transaction: feeBumpTransaction };
  });
  return feeBumpPlugin;
};

export * from "@/error.ts";
export * from "@/types.ts";
export {
  createFeeBumpPipeline,
  type FeeBumpPipeline,
} from "@/pipeline/pipeline.ts";
