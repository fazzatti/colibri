import { type Step, step } from "convee";
import { resolveVerificationTarget } from "../processes/resolve-verification-target/index.ts";
import { RESOLVE_VERIFICATION_TARGET_STEP_ID } from "./ids.ts";

/** Creates the resolve-verification-target step used in verifier pipelines. */
export const createResolveVerificationTargetStep = (): Step<
  Parameters<typeof resolveVerificationTarget>[0],
  Awaited<ReturnType<typeof resolveVerificationTarget>>,
  Error,
  typeof RESOLVE_VERIFICATION_TARGET_STEP_ID
> =>
  step(resolveVerificationTarget, { id: RESOLVE_VERIFICATION_TARGET_STEP_ID });
