import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type { SignatureRequirement, Signer } from "@/signer/types.ts";

export type SignEnvelopeInput = {
  transaction: Transaction | FeeBumpTransaction;
  signatureRequirements: SignatureRequirement[];
  signers: Signer[];
};

export type SignEnvelopeOutput = Transaction | FeeBumpTransaction;
