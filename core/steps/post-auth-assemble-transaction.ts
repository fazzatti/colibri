import { type Step, step } from "convee";
import { postAuthAssembleTransaction } from "@/processes/index.ts";
import { POST_AUTH_ASSEMBLE_TRANSACTION_STEP_ID } from "@/steps/ids.ts";

/**
 * Creates the post-auth-assemble-transaction step used in Colibri pipelines.
 *
 * @returns A configured post-auth assembly step.
 */
export const createPostAuthAssembleTransactionStep = (): Step<
  Parameters<typeof postAuthAssembleTransaction>[0],
  Awaited<ReturnType<typeof postAuthAssembleTransaction>>,
  Error,
  typeof POST_AUTH_ASSEMBLE_TRANSACTION_STEP_ID
> =>
  step(postAuthAssembleTransaction, {
    id: POST_AUTH_ASSEMBLE_TRANSACTION_STEP_ID,
  });
