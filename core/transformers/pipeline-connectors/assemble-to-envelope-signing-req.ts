import type { Transformer } from "convee";

import type { AssembleTransactionOutput } from "@/processes/assemble-transaction/types.ts";
import type { EnvelopeSigningRequirementsInput } from "@/processes/envelope-signing-requirements/types.ts";
export const assembleToEnvelopeSigningRequirements: Transformer<
  AssembleTransactionOutput,
  EnvelopeSigningRequirementsInput
> = (transaction) => {
  return { transaction };
};
