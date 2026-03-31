import { step, type Step } from "convee";
import { signAuthEntries } from "@/processes/index.ts";
import { SIGN_AUTH_ENTRIES_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the sign-auth-entries step used in Colibri pipelines.
 *
 * @returns A configured sign-auth-entries step.
 */
export const createSignAuthEntriesStep = (): Step<
  Parameters<typeof signAuthEntries>[0],
  Awaited<ReturnType<typeof signAuthEntries>>,
  Error,
  typeof SIGN_AUTH_ENTRIES_STEP_ID
> =>
  step(signAuthEntries, { id: SIGN_AUTH_ENTRIES_STEP_ID });
