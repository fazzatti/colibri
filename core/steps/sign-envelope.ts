import { step } from "convee";
import { signEnvelope } from "@/processes/index.ts";
import { SIGN_ENVELOPE_STEP_ID } from "@/steps/ids.ts";

export const createSignEnvelopeStep = () =>
  step(signEnvelope, { id: SIGN_ENVELOPE_STEP_ID });
