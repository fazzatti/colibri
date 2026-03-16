import { step, type StepThis } from "convee";
import type { Signer, SignatureRequirement } from "@/signer/types.ts";
import type { EnvelopeSigningRequirementsOutput } from "@/processes/envelope-signing-requirements/types.ts";
import type { SignEnvelopeInput } from "@/processes/sign-envelope/types.ts";
import { getRequiredStepOutput } from "@/pipelines/shared/connectors/runtime.ts";

type InputWithSigners = {
  config: {
    signers: Signer[];
  };
};

export const createEnvSignReqToSignEnvelope = <
  Input extends InputWithSigners,
  TransactionOutput extends SignEnvelopeInput["transaction"],
>(args: {
  id: string;
  inputStepId: string;
  transactionStepId: string;
}) =>
  step(function (
    this: StepThis,
    ...envelopeSigningRequirementsOutput: EnvelopeSigningRequirementsOutput
  ): SignEnvelopeInput {
    const inputStep = getRequiredStepOutput<Input>(this, args.inputStepId);
    const signers = inputStep.config.signers;

    const transaction = getRequiredStepOutput<TransactionOutput>(
      this,
      args.transactionStepId,
    );

    const signatureRequirements =
      envelopeSigningRequirementsOutput as SignatureRequirement[];

    return {
      signatureRequirements,
      transaction,
      signers,
    };
  }, { id: args.id });
