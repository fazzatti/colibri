import { type Step, step } from "convee";
import { parseClassicTransactionOutcome } from "@/processes/index.ts";
import { PARSE_CLASSIC_TRANSACTION_OUTCOME_STEP_ID } from "@/steps/ids.ts";

/** Creates the runtime classic-transaction outcome parsing step. */
export const createParseClassicTransactionOutcomeStep = (): Step<
  Parameters<typeof parseClassicTransactionOutcome>[0],
  ReturnType<typeof parseClassicTransactionOutcome>,
  Error,
  typeof PARSE_CLASSIC_TRANSACTION_OUTCOME_STEP_ID
> =>
  step(parseClassicTransactionOutcome, {
    id: PARSE_CLASSIC_TRANSACTION_OUTCOME_STEP_ID,
  });
