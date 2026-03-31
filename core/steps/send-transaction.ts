import { step, type Step } from "convee";
import { sendTransaction } from "@/processes/index.ts";
import { SEND_TRANSACTION_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the send-transaction step used in Colibri pipelines.
 *
 * @returns A configured send-transaction step.
 */
export const createSendTransactionStep = (): Step<
  Parameters<typeof sendTransaction>[0],
  Awaited<ReturnType<typeof sendTransaction>>,
  Error,
  typeof SEND_TRANSACTION_STEP_ID
> =>
  step(sendTransaction, { id: SEND_TRANSACTION_STEP_ID });
