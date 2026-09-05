import type {
  createClassicTransactionPipeline,
  createInvokeContractPipeline,
  SendTransactionInput,
} from "@colibri/core";
import { type PipeStepPlugin, plugin } from "convee";
import { checkMemoRequired } from "@/check-memo-required.ts";
import { SEP29_PLUGIN_ID, SEP29_PLUGIN_TARGET } from "@/types.ts";

type SendStep<Pipeline extends { steps: readonly unknown[] }> = Extract<
  Pipeline["steps"][number],
  { id: typeof SEP29_PLUGIN_TARGET }
>;
type Sep29RuntimePlugin =
  & PipeStepPlugin<
    SendStep<ReturnType<typeof createClassicTransactionPipeline>>,
    Error
  >
  & PipeStepPlugin<
    SendStep<ReturnType<typeof createInvokeContractPipeline>>,
    Error
  >;

/**
 * Creates an opt-in SEP-29 guard for the `send-transaction` step.
 *
 * Uses that step's RPC client and checks the same transaction it would submit.
 * The input object and envelope are returned unchanged. Attach after plugins
 * that modify payment destinations or memos. Fee-bump wrapping can precede or
 * follow this guard because both operate on the same inner transaction.
 * Nothing is installed in Colibri's default pipelines automatically.
 */
export const createSep29Plugin = (): Sep29RuntimePlugin =>
  plugin({ id: SEP29_PLUGIN_ID, target: SEP29_PLUGIN_TARGET }).onInput(
    async (input: SendTransactionInput): Promise<SendTransactionInput> => {
      await checkMemoRequired({
        transaction: input.transaction,
        rpc: input.rpc,
      });
      return input;
    },
  );
