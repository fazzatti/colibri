import { step } from "convee";
import { sendTransaction } from "@/processes/index.ts";
import { SEND_TRANSACTION_STEP_ID } from "@/steps/ids.ts";

export const createSendTransactionStep = () =>
  step(sendTransaction, { id: SEND_TRANSACTION_STEP_ID });
