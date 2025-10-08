import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import type {
  SignatureRequirement,
  TransactionSigner,
} from "../../common/types.ts";

export type SignEnvelopeInput = {
  transaction: Transaction | FeeBumpTransaction;
  signatureRequirements: SignatureRequirement[];
  signers: TransactionSigner[];
};

export type SignEnvelopeOutput = Transaction | FeeBumpTransaction;
