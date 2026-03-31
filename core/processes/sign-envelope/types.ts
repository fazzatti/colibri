import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type { SignatureRequirement, Signer } from "@/signer/types.ts";

/** @internal */
export type SignEnvelopeInput = {
  transaction: Transaction | FeeBumpTransaction;
  signatureRequirements: SignatureRequirement[];
  signers: Signer[];
};

/** @internal */
export type SignEnvelopeOutput = Transaction | FeeBumpTransaction;
