import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type { SignatureRequirement } from "@/signer/types.ts";

/** @internal */
export type EnvelopeSigningRequirementsInput = {
  transaction: Transaction | FeeBumpTransaction;
};

/** @internal */
export type EnvelopeSigningRequirementsOutput = SignatureRequirement[];
