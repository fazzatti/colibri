import { step, type Step } from "convee";
import { wrapFeeBump } from "@/processes/index.ts";
import { WRAP_FEE_BUMP_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the wrap-fee-bump step used in Colibri pipelines.
 *
 * @returns A configured wrap-fee-bump step.
 */
export const createWrapFeeBumpStep = (): Step<
  Parameters<typeof wrapFeeBump>[0],
  Awaited<ReturnType<typeof wrapFeeBump>>,
  Error,
  typeof WRAP_FEE_BUMP_STEP_ID
> =>
  step(wrapFeeBump, { id: WRAP_FEE_BUMP_STEP_ID });
