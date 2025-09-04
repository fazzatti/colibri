import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type { SignatureRequirement } from "../../common/types.ts";

export type EnvelopeSigningRequirementsInput = {
  transaction: Transaction | FeeBumpTransaction;
};

export type EnvelopeSigningRequirementsOutput = SignatureRequirement[];
