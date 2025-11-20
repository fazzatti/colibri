import { ProcessEngine } from "convee";
import type {
  EnvelopeSigningRequirementsInput,
  EnvelopeSigningRequirementsOutput,
} from "@/processes/envelope-signing-requirements/types.ts";
import * as E from "@/processes/envelope-signing-requirements/error.ts";
import { isFeeBumpTransaction } from "@/common/verifiers/is-fee-bump-transaction.ts";
import { isTransaction } from "@/common/verifiers/is-transaction.ts";
import { muxedAddressToBaseAccount } from "@/transformers/address/index.ts";
import { ColibriError } from "@/error/index.ts";
import { getRequiredOperationThresholdForClassicOperation } from "@/transformers/auth/index.ts";
import {
  OperationThreshold,
  type SignatureRequirement,
  type SignatureRequirementRaw,
} from "@/signer/types.ts";
import type { Ed25519PublicKey, MuxedAddress } from "@/strkeys/types.ts";
import { StrKey } from "@/strkeys/index.ts";

const envelopeSigningRequirementsProcess = (
  input: EnvelopeSigningRequirementsInput
): EnvelopeSigningRequirementsOutput => {
  try {
    const { transaction } = input;

    try {
      if (isFeeBumpTransaction(transaction)) {
        const address = sourceToAddress(transaction.feeSource);

        const sourceRequirement = {
          address,
          thresholdLevel: OperationThreshold.low,
        };

        return [sourceRequirement];
      }
    } catch (e) {
      throw new E.FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX(
        input,
        e as Error
      );
    }

    try {
      if (isTransaction(transaction)) {
        const address = sourceToAddress(transaction.source);

        const sourceRequirement = {
          address,
          thresholdLevel: OperationThreshold.medium,
        };

        const { operations } = transaction;

        const opRequirements = [];
        for (const op of operations) {
          const signerRequirements =
            getRequiredOperationThresholdForClassicOperation(op);
          if (signerRequirements) opRequirements.push(signerRequirements);
        }

        const finalRequirements = [
          ...removeConflictingRequirements(opRequirements, sourceRequirement),
        ];

        return finalRequirements;
      }
    } catch (e) {
      throw new E.FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION(
        input,
        e as Error
      );
    }

    throw new E.INVALID_TRANSACTION_TYPE(input);
  } catch (e) {
    if (e instanceof E.EnvelopeSigningRequirementsError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};

const sourceToAddress = (source: string): Ed25519PublicKey => {
  if (StrKey.isMuxedAddress(source)) {
    return muxedAddressToBaseAccount(source as MuxedAddress);
  }

  if (StrKey.isEd25519PublicKey(source)) {
    return source;
  }

  throw ColibriError.unexpected({
    message: `Invalid source address: '${source}'`,
  });
};

const removeConflictingRequirements = (
  operationRequirements: SignatureRequirementRaw[],
  sourceRequirement: SignatureRequirement
): SignatureRequirement[] => {
  const requirementsBundle: SignatureRequirement[] = [sourceRequirement];

  for (const requirement of operationRequirements) {
    const publicKey =
      requirement.address === "source-account"
        ? sourceRequirement.address
        : requirement.address;

    const index = requirementsBundle.findIndex((r) => r.address === publicKey);
    if (index === -1) {
      requirementsBundle.push({
        address: publicKey,
        thresholdLevel: requirement.thresholdLevel,
      });
    } else {
      requirementsBundle[index].thresholdLevel = Math.max(
        requirementsBundle[index].thresholdLevel,
        requirement.thresholdLevel
      );
    }
  }

  return requirementsBundle;
};

const PROCESS_NAME = "EnvelopeSigningRequirements" as const;

const P_EnvelopeSigningRequirements = () =>
  ProcessEngine.create<
    EnvelopeSigningRequirementsInput,
    EnvelopeSigningRequirementsOutput,
    E.EnvelopeSigningRequirementsError,
    typeof PROCESS_NAME
  >(envelopeSigningRequirementsProcess, {
    name: PROCESS_NAME,
  });

const P_EnvelopeSigningRequirementsErrors = E;

export { P_EnvelopeSigningRequirements, P_EnvelopeSigningRequirementsErrors };
