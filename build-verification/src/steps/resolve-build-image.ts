import { type Step, step } from "convee";
import { resolveBuildImage } from "../processes/resolve-build-image/index.ts";
import { RESOLVE_BUILD_IMAGE_STEP_ID } from "./ids.ts";

/** Creates the resolve-build-image step used in verifier pipelines. */
export const createResolveBuildImageStep = (): Step<
  Parameters<typeof resolveBuildImage>[0],
  Awaited<ReturnType<typeof resolveBuildImage>>,
  Error,
  typeof RESOLVE_BUILD_IMAGE_STEP_ID
> => step(resolveBuildImage, { id: RESOLVE_BUILD_IMAGE_STEP_ID });
