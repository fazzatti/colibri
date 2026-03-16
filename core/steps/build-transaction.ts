import { step } from "convee";
import { buildTransaction } from "@/processes/index.ts";
import { BUILD_TRANSACTION_STEP_ID } from "@/steps/ids.ts";

export const createBuildTransactionStep = () =>
  step(buildTransaction, { id: BUILD_TRANSACTION_STEP_ID });
