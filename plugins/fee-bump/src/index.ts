import { Plugin } from "convee";
import {
  type FeeBumpPluginArgs,
  PLUGIN_NAME,
  type PluginInput,
} from "./types.ts";
import { PIPE_FeeBump } from "./pipeline/pipeline.ts";
import { assert, isTransaction, P_SendTransaction } from "@colibri/core";
import * as E from "./error.ts";

const create = ({ networkConfig, feeBumpConfig }: FeeBumpPluginArgs) => {
  const wrapperPipeline = PIPE_FeeBump.create({
    networkConfig,
    feeBumpConfig,
  });

  const plugin = Plugin.create(
    {
      processInput: async (input: PluginInput): Promise<PluginInput> => {
        const { transaction } = input;

        assert(
          isTransaction(transaction),
          new E.NOT_A_TRANSACTION(transaction)
        );

        const feeBumpTransaction = await wrapperPipeline.run({ transaction });

        return { ...input, transaction: feeBumpTransaction };
      },
    },
    {
      name: PLUGIN_NAME,
    }
  );
  return plugin;
};

export const PLG_FeeBump = {
  create,
  name: PLUGIN_NAME,
  target: P_SendTransaction().name,
};
