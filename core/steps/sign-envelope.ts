import { step, type Step } from "convee";
import { signEnvelope } from "@/processes/index.ts";
import { SIGN_ENVELOPE_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the sign-envelope step used in Colibri pipelines.
 *
 * @returns A configured sign-envelope step.
 */
export const createSignEnvelopeStep = (): Step<
  Parameters<typeof signEnvelope>[0],
  Awaited<ReturnType<typeof signEnvelope>>,
  Error,
  typeof SIGN_ENVELOPE_STEP_ID
> =>
  step(signEnvelope, { id: SIGN_ENVELOPE_STEP_ID });
