import type { MetadataHelper, Transformer } from "convee";
import type {
  FeeBumpConfig,
  WrapFeeBumpInput,
  WrapFeeBumpOutput,
  EnvelopeSigningRequirementsInput,
  EnvelopeSigningRequirementsOutput,
  SignEnvelopeInput,
} from "@colibri/core";
import type { FeeBumpPipelineInput } from "./types.ts";

export const inputToBuild = (
  networkPassphrase: string,
  config: FeeBumpConfig
) => {
  return (input: FeeBumpPipelineInput): WrapFeeBumpInput => {
    const { transaction } = input;
    return { transaction, config, networkPassphrase };
  };
};

export const wrapFeeBumpToEnvelopeSigningRequirements: Transformer<
  WrapFeeBumpOutput,
  EnvelopeSigningRequirementsInput
> = (transaction) => {
  return { transaction };
};

export const envSignReqToSignEnvelope = (
  wrapFeeBumpOutput: string,
  config: FeeBumpConfig
): Transformer<EnvelopeSigningRequirementsOutput, SignEnvelopeInput> => {
  return ((
    envelopeSigningRequirementsOutput: EnvelopeSigningRequirementsOutput,
    metadata: MetadataHelper
  ): SignEnvelopeInput => {
    const signers = config.signers;

    const transaction = metadata.get(wrapFeeBumpOutput) as WrapFeeBumpOutput;

    const signatureRequirements = envelopeSigningRequirementsOutput;

    return {
      signatureRequirements,
      transaction,
      signers,
    };
  }) as Transformer<EnvelopeSigningRequirementsOutput, SignEnvelopeInput>;
};
