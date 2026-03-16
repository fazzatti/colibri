import { step } from "convee";
import { signAuthEntries } from "@/processes/index.ts";
import { SIGN_AUTH_ENTRIES_STEP_ID } from "@/steps/ids.ts";

export const createSignAuthEntriesStep = () =>
  step(signAuthEntries, { id: SIGN_AUTH_ENTRIES_STEP_ID });
