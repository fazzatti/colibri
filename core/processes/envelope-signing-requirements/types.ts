import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type { SignatureRequirement } from "@/signer/types.ts";

export type EnvelopeSigningRequirementsInput = {
  transaction: Transaction | FeeBumpTransaction;
};

export type EnvelopeSigningRequirementsOutput = SignatureRequirement[];
