import { type Step, step } from "convee";
import { enforceSimulation } from "@/processes/index.ts";
import { ENFORCE_SIMULATION_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the enforce-simulation step used in Colibri pipelines.
 *
 * @returns A configured enforcing-simulation step.
 */
export const createEnforceSimulationStep = (): Step<
  Parameters<typeof enforceSimulation>[0],
  Awaited<ReturnType<typeof enforceSimulation>>,
  Error,
  typeof ENFORCE_SIMULATION_STEP_ID
> =>
  step(enforceSimulation, {
    id: ENFORCE_SIMULATION_STEP_ID,
  });
