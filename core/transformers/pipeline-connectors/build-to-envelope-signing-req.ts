import type { Transformer } from "convee";

import type { EnvelopeSigningRequirementsInput } from "../../processes/envelope-signing-requirements/types.ts";
import type { BuildTransactionOutput } from "../../processes/build-transaction/types.ts";
export const buildToEnvelopeSigningRequirements: Transformer<
  BuildTransactionOutput,
  EnvelopeSigningRequirementsInput
> = (transaction) => {
  return { transaction };
};
