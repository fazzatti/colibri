import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type { SignatureRequirement } from "../../common/types.ts";
import type { Ed25519Signer } from "../../common/types.ts";

export type SignEnvelopeInput = {
  transaction: Transaction | FeeBumpTransaction;
  signatureRequirements: SignatureRequirement[];
  signers: Ed25519Signer[];
};

export type SignEnvelopeOutput = Transaction | FeeBumpTransaction;
