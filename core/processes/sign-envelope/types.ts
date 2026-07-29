import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type {
  SignatureRequirement,
  TransactionSigner,
} from "@/signer/types.ts";

/** @internal */
export type SignEnvelopeInput = {
  transaction: Transaction | FeeBumpTransaction;
  signatureRequirements: SignatureRequirement[];
  signers: TransactionSigner[];
};

/** @internal */
export type SignEnvelopeOutput = Transaction | FeeBumpTransaction;
