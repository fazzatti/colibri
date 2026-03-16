import { step } from "convee";
import { wrapFeeBump } from "@/processes/index.ts";
import { WRAP_FEE_BUMP_STEP_ID } from "@/steps/ids.ts";

export const createWrapFeeBumpStep = () =>
  step(wrapFeeBump, { id: WRAP_FEE_BUMP_STEP_ID });
