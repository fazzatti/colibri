import { type Step, step } from "convee";
import { selectBuildArtifact } from "@/processes/select-build-artifact/index.ts";
import { SELECT_BUILD_ARTIFACT_STEP_ID } from "@/steps/ids.ts";

/** Creates the select-build-artifact step used in verifier pipelines. */
export const createSelectBuildArtifactStep = (): Step<
  Parameters<typeof selectBuildArtifact>[0],
  Awaited<ReturnType<typeof selectBuildArtifact>>,
  Error,
  typeof SELECT_BUILD_ARTIFACT_STEP_ID
> => step(selectBuildArtifact, { id: SELECT_BUILD_ARTIFACT_STEP_ID });
