import { step } from "convee";
import { simulateTransaction } from "@/processes/index.ts";
import { SIMULATE_TRANSACTION_STEP_ID } from "@/steps/ids.ts";

export const createSimulateTransactionStep = () =>
  step(simulateTransaction, { id: SIMULATE_TRANSACTION_STEP_ID });
