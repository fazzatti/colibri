import { type Step, step } from "convee";
import { executeContractBuild } from "@/processes/execute-contract-build/index.ts";
import { EXECUTE_CONTRACT_BUILD_STEP_ID } from "@/steps/ids.ts";

/** Creates the execute-contract-build step used in verifier pipelines. */
export const createExecuteContractBuildStep = (): Step<
  Parameters<typeof executeContractBuild>[0],
  Awaited<ReturnType<typeof executeContractBuild>>,
  Error,
  typeof EXECUTE_CONTRACT_BUILD_STEP_ID
> => step(executeContractBuild, { id: EXECUTE_CONTRACT_BUILD_STEP_ID });
