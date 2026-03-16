import { plugin } from "convee";
import {
  type FeeBumpPluginArgs,
  PLUGIN_NAME,
  type PluginInput,
} from "@/types.ts";
import { PIPE_FeeBump } from "@/pipeline/pipeline.ts";
import { assert, isTransaction, steps } from "@colibri/core";
import * as E from "@/error.ts";

const create = ({ networkConfig, feeBumpConfig }: FeeBumpPluginArgs) => {
  const wrapperPipeline = PIPE_FeeBump.create({
    networkConfig,
    feeBumpConfig,
  });

  const feeBumpPlugin = plugin({
    id: PLUGIN_NAME,
    target: steps.SEND_TRANSACTION_STEP_ID,
  }).onInput(async (input: PluginInput): Promise<PluginInput> => {
      const { transaction } = input;

      assert(isTransaction(transaction), new E.NOT_A_TRANSACTION(transaction));

      const feeBumpTransaction = await wrapperPipeline({ transaction });

      return { ...input, transaction: feeBumpTransaction };
  });
  return feeBumpPlugin;
};

export const PLG_FeeBump = {
  create,
  name: PLUGIN_NAME,
  target: steps.SEND_TRANSACTION_STEP_ID,
};
