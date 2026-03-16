import { step } from "convee";
import { assembleTransaction } from "@/processes/index.ts";
import { ASSEMBLE_TRANSACTION_STEP_ID } from "@/steps/ids.ts";

export const createAssembleTransactionStep = () =>
  step(assembleTransaction, { id: ASSEMBLE_TRANSACTION_STEP_ID });
