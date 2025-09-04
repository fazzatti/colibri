import { ProcessEngine } from "convee";
import type {
  EnvelopeSigningRequirementsInput,
  EnvelopeSigningRequirementsOutput,
} from "./types.ts";
import * as E from "./error.ts";

import {
  type Ed25519PublicKey,
  OperationThreshold,
  type SignatureRequirement,
  type SignatureRequirementRaw,
} from "../../common/types.ts";
import { isFeeBumpTransaction } from "../../common/verifiers/is-fee-bump-transaction.ts";
import { isTransaction } from "../../common/verifiers/is-transaction.ts";
import { isMuxedAddress } from "../../common/verifiers/is-muxed-address.ts";
import { muxedAddressToBaseAccount } from "../../transformers/address/index.ts";
import { isEd25519PublicKey } from "../../common/verifiers/is-ed25519-public-key.ts";
import { ColibriError } from "../../error/index.ts";
import { getRequiredOperationThresholdForClassicOperation } from "../../transformers/auth/index.ts";

const envelopeSigningRequirementsProcess = (
  input: EnvelopeSigningRequirementsInput
): EnvelopeSigningRequirementsOutput => {
  try {
    const { transaction } = input;

    try {
      if (isFeeBumpTransaction(transaction)) {
        const signer = sourceToSigner(transaction.feeSource);

        const sourceRequirement = {
          signer,
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
        const signer = sourceToSigner(transaction.source);

        const sourceRequirement = {
          signer,
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

const sourceToSigner = (source: string): Ed25519PublicKey => {
  if (isMuxedAddress(source)) {
    return muxedAddressToBaseAccount(source);
  }

  if (isEd25519PublicKey(source)) {
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
      requirement.signer === "source-account"
        ? sourceRequirement.signer
        : requirement.signer;

    const index = requirementsBundle.findIndex((r) => r.signer === publicKey);
    if (index === -1) {
      requirementsBundle.push({
        signer: publicKey,
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

const EnvelopeSigningRequirements = ProcessEngine.create<
  EnvelopeSigningRequirementsInput,
  EnvelopeSigningRequirementsOutput,
  E.EnvelopeSigningRequirementsError
>(envelopeSigningRequirementsProcess, {
  name: "EnvelopeSigningRequirements",
});

export { EnvelopeSigningRequirements };
