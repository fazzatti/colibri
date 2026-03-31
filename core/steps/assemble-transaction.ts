import { step, type Step } from "convee";
import { assembleTransaction } from "@/processes/index.ts";
import { ASSEMBLE_TRANSACTION_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the assemble-transaction step used in Colibri pipelines.
 *
 * @returns A configured assemble-transaction step.
 */
export const createAssembleTransactionStep = (): Step<
  Parameters<typeof assembleTransaction>[0],
  Awaited<ReturnType<typeof assembleTransaction>>,
  Error,
  typeof ASSEMBLE_TRANSACTION_STEP_ID
> =>
  step(assembleTransaction, { id: ASSEMBLE_TRANSACTION_STEP_ID });
