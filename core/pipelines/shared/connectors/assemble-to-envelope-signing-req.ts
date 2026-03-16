import type { AssembleTransactionOutput } from "@/processes/assemble-transaction/types.ts";
import type { EnvelopeSigningRequirementsInput } from "@/processes/envelope-signing-requirements/types.ts";

export const assembleToEnvelopeSigningRequirements = (
  transaction: AssembleTransactionOutput,
): EnvelopeSigningRequirementsInput => {
  return { transaction };
};
