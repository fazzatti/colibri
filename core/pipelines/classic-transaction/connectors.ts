import type { Server } from "stellar-sdk/rpc";
import type { MetadataHelper, Transformer } from "convee";
import type {
  ClassicTransactionInput,
  ClassicTransactionOutput,
} from "@/pipelines/classic-transaction/types.ts";
import type { BuildTransactionInput } from "@/processes/build-transaction/types.ts";
import type { AssembleTransactionOutput } from "@/processes/assemble-transaction/types.ts";
import type { EnvelopeSigningRequirementsOutput } from "@/processes/envelope-signing-requirements/types.ts";
import type {
  SignEnvelopeInput,
  SignEnvelopeOutput,
} from "@/processes/sign-envelope/types.ts";
import type {
  SendTransactionInput,
  SendTransactionOutput,
} from "@/processes/send-transaction/types.ts";

export const inputToBuild = (rpc: Server, networkPassphrase: string) => {
  return (input: ClassicTransactionInput): BuildTransactionInput => {
    const { operations, config } = input;

    return {
      baseFee: config.fee,
      source: config.source,
      networkPassphrase,
      operations,
      rpc,
    };
  };
};

export const envSignReqToSignEnvelope = (
  buildTransactionOutputKey: string,
  inputKey: string
): Transformer<EnvelopeSigningRequirementsOutput, SignEnvelopeInput> => {
  return ((
    envelopeSigningRequirementsOutput: EnvelopeSigningRequirementsOutput,
    metadata: MetadataHelper
  ): SignEnvelopeInput => {
    const inputStep = metadata.get(inputKey) as ClassicTransactionInput;
    const signers = inputStep.config.signers;

    const transaction = metadata.get(
      buildTransactionOutputKey
    ) as AssembleTransactionOutput;

    const signatureRequirements = envelopeSigningRequirementsOutput;

    return {
      signatureRequirements,
      transaction,
      signers,
    };
  }) as Transformer<EnvelopeSigningRequirementsOutput, SignEnvelopeInput>;
};

export const signEnvelopeToSendTransaction = (
  rpc: Server
): Transformer<SignEnvelopeOutput, SendTransactionInput> => {
  return (transaction: SignEnvelopeOutput) => {
    return { transaction, rpc };
  };
};

export const sendTransactionToPipeOutput: Transformer<
  SendTransactionOutput,
  ClassicTransactionOutput
> = (sendOutput: SendTransactionOutput) => {
  return { hash: sendOutput.hash, response: sendOutput.response };
};
