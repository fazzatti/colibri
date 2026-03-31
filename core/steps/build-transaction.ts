import { step, type Step } from "convee";
import { buildTransaction } from "@/processes/index.ts";
import { BUILD_TRANSACTION_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the build-transaction step used in Colibri pipelines.
 *
 * @returns A configured build-transaction step.
 */
export const createBuildTransactionStep = (): Step<
  Parameters<typeof buildTransaction>[0],
  Awaited<ReturnType<typeof buildTransaction>>,
  Error,
  typeof BUILD_TRANSACTION_STEP_ID
> =>
  step(buildTransaction, { id: BUILD_TRANSACTION_STEP_ID });
