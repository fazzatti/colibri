import type {
  createClassicTransactionPipeline,
  createInvokeContractPipeline,
} from "@colibri/core";
import {
  plugin,
  type PipeStepPlugin,
} from "convee";
import {
  FEE_BUMP_PLUGIN_ID,
  FEE_BUMP_PLUGIN_TARGET,
  type FeeBumpPluginArgs,
  type PluginInput,
} from "@/types.ts";
import { createFeeBumpPipeline } from "@/pipeline/pipeline.ts";
import { assert, isTransaction } from "@colibri/core";
import * as E from "@/error.ts";

type ClassicTransactionPipeline = ReturnType<
  typeof createClassicTransactionPipeline
>;
type InvokeContractPipeline = ReturnType<typeof createInvokeContractPipeline>;

type SendTransactionStep<Pipeline extends { steps: readonly unknown[] }> =
  Extract<
    Pipeline["steps"][number],
    { id: typeof FEE_BUMP_PLUGIN_TARGET }
  >;

type FeeBumpRuntimePlugin =
  & PipeStepPlugin<SendTransactionStep<ClassicTransactionPipeline>, Error>
  & PipeStepPlugin<SendTransactionStep<InvokeContractPipeline>, Error>;

/**
 * Creates a plugin that wraps outgoing transactions in a fee-bump envelope.
 *
 * @param args - Plugin configuration.
 * @returns A plugin targeting the send-transaction step.
 * @throws {E.MISSING_ARG} If a required plugin argument is missing.
 * @throws {E.NOT_A_TRANSACTION} If the intercepted payload does not contain a transaction.
 */
export const createFeeBumpPlugin = ({
  networkConfig,
  feeBumpConfig,
}: FeeBumpPluginArgs): FeeBumpRuntimePlugin => {
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

export { FEE_BUMP_PLUGIN_ID, FEE_BUMP_PLUGIN_TARGET } from "@/types.ts";
