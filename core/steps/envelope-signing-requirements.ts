import { step } from "convee";
import { envelopeSigningRequirements } from "@/processes/index.ts";
import { ENVELOPE_SIGNING_REQUIREMENTS_STEP_ID } from "@/steps/ids.ts";

export const createEnvelopeSigningRequirementsStep = () =>
  step(envelopeSigningRequirements, {
    id: ENVELOPE_SIGNING_REQUIREMENTS_STEP_ID,
  });
