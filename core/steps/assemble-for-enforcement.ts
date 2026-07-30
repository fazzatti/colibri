import { type Step, step } from "convee";
import { assembleForEnforcement } from "@/processes/index.ts";
import { ASSEMBLE_FOR_ENFORCEMENT_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the assemble-for-enforcement step used in Colibri pipelines.
 *
 * @returns A configured assembly-for-enforcement step.
 */
export const createAssembleForEnforcementStep = (): Step<
  Parameters<typeof assembleForEnforcement>[0],
  Awaited<ReturnType<typeof assembleForEnforcement>>,
  Error,
  typeof ASSEMBLE_FOR_ENFORCEMENT_STEP_ID
> =>
  step(assembleForEnforcement, {
    id: ASSEMBLE_FOR_ENFORCEMENT_STEP_ID,
  });
