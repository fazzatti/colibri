import type { Server } from "stellar-sdk/rpc";
import type { MetadataHelper, Transformer } from "convee";
import type { InvokeContractInput } from "@/pipelines/invoke-contract/types.ts";
import type {
  BuildTransactionInput,
  BuildTransactionOutput,
} from "@/processes/build-transaction/types.ts";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";
import type {
  AssembleTransactionInput,
  AssembleTransactionOutput,
} from "@/processes/assemble-transaction/types.ts";
import type {
  SignAuthEntriesInput,
  SignAuthEntriesOutput,
} from "@/processes/sign-auth-entries/types.ts";
import type { EnvelopeSigningRequirementsOutput } from "@/processes/envelope-signing-requirements/types.ts";
import type {
  SignEnvelopeInput,
  SignEnvelopeOutput,
} from "@/processes/sign-envelope/types.ts";
import type { SendTransactionInput } from "@/processes/send-transaction/types.ts";

export const inputToBuild = (rpc: Server, networkPassphrase: string) => {
  return (input: InvokeContractInput): BuildTransactionInput => {
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

export const simulateToSignAuthEntries = (
  inputKey: string,
  rpc: Server,
  networkPassphrase: string
): Transformer<SimulateTransactionOutput, SignAuthEntriesInput> => {
  return ((
    simulationResponse: SimulateTransactionOutput,
    metadata: MetadataHelper
  ): SignAuthEntriesInput => {
    const authEntries = simulationResponse.result?.auth || [];
    const inputStep = metadata.get(inputKey) as InvokeContractInput;
    const signers = inputStep.config.signers || [];

    return {
      auth: authEntries,
      signers,
      rpc,
      networkPassphrase,
    };
  }) as Transformer<SimulateTransactionOutput, SignAuthEntriesInput>;
};

export const signAuthEntriesToAssemble = (
  buildTransactionOutputKey: string,
  simulateTransactionOutputKey: string
): Transformer<SignAuthEntriesOutput, AssembleTransactionInput> => {
  return ((
    signAuthEntriesOutput: SignAuthEntriesOutput,
    metadata: MetadataHelper
  ): AssembleTransactionInput => {
    const transaction = metadata.get(
      buildTransactionOutputKey
    ) as BuildTransactionOutput;

    const simulateOutput = metadata.get(
      simulateTransactionOutputKey
    ) as SimulateTransactionOutput;

    const sorobanData = simulateOutput.transactionData;
    const authEntries = signAuthEntriesOutput;
    const resourceFee = parseInt(simulateOutput.minResourceFee);

    return {
      authEntries,
      transaction,
      sorobanData,
      resourceFee,
    };
  }) as Transformer<SignAuthEntriesOutput, AssembleTransactionInput>;
};

export const envSignReqToSignEnvelope = (
  assembleTransactionOutputKey: string,
  inputKey: string
): Transformer<EnvelopeSigningRequirementsOutput, SignEnvelopeInput> => {
  return ((
    envelopeSigningRequirementsOutput: EnvelopeSigningRequirementsOutput,
    metadata: MetadataHelper
  ): SignEnvelopeInput => {
    const inputStep = metadata.get(inputKey) as InvokeContractInput;
    const signers = inputStep.config.signers;

    const transaction = metadata.get(
      assembleTransactionOutputKey
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
