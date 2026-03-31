import { step, type Step } from "convee";
import { simulateTransaction } from "@/processes/index.ts";
import { SIMULATE_TRANSACTION_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the simulate-transaction step used in Colibri pipelines.
 *
 * @returns A configured simulate-transaction step.
 */
export const createSimulateTransactionStep = (): Step<
  Parameters<typeof simulateTransaction>[0],
  Awaited<ReturnType<typeof simulateTransaction>>,
  Error,
  typeof SIMULATE_TRANSACTION_STEP_ID
> =>
  step(simulateTransaction, { id: SIMULATE_TRANSACTION_STEP_ID });
