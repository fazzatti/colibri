import { step, type Step } from "convee";
import { envelopeSigningRequirements } from "@/processes/index.ts";
import { ENVELOPE_SIGNING_REQUIREMENTS_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the envelope-signing-requirements step used in Colibri pipelines.
 *
 * @returns A configured envelope-signing-requirements step.
 */
export const createEnvelopeSigningRequirementsStep = (): Step<
  Parameters<typeof envelopeSigningRequirements>[0],
  Awaited<ReturnType<typeof envelopeSigningRequirements>>,
  Error,
  typeof ENVELOPE_SIGNING_REQUIREMENTS_STEP_ID
> =>
  step(envelopeSigningRequirements, {
    id: ENVELOPE_SIGNING_REQUIREMENTS_STEP_ID,
  });
