import { type Step, step } from "convee";
import { postAuthEnforcedSimulation } from "@/processes/index.ts";
import { POST_AUTH_ENFORCED_SIMULATION_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the post-auth-enforced-simulation step used in Colibri pipelines.
 *
 * @returns A configured post-auth enforcing-simulation step.
 */
export const createPostAuthEnforcedSimulationStep = (): Step<
  Parameters<typeof postAuthEnforcedSimulation>[0],
  Awaited<ReturnType<typeof postAuthEnforcedSimulation>>,
  Error,
  typeof POST_AUTH_ENFORCED_SIMULATION_STEP_ID
> =>
  step(postAuthEnforcedSimulation, {
    id: POST_AUTH_ENFORCED_SIMULATION_STEP_ID,
  });
