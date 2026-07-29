import type {
  AuthEntrySigner,
  EnvelopeSigner,
  Signer,
  TransactionSigner,
} from "@/signer/types.ts";
import { isDefined } from "@/common/index.ts";
import { hasFunction } from "@/common/type-guards/has-function.ts";

/** Returns `true` when the value can sign transaction envelopes. */
export const isEnvelopeSigner = (
  signer: TransactionSigner | unknown,
): signer is EnvelopeSigner => {
  return (
    isDefined(signer) &&
    hasFunction(signer, "signTransaction") &&
    hasFunction(signer, "signsFor")
  );
};

/** Returns `true` when the value can sign Soroban authorization entries. */
export const isAuthEntrySigner = (
  signer: TransactionSigner | unknown,
): signer is AuthEntrySigner => {
  return (
    isDefined(signer) &&
    hasFunction(signer, "signSorobanAuthEntry") &&
    hasFunction(signer, "signsFor")
  );
};

/** Returns `true` when the value satisfies Colibri's complete signer contract. */
export const isSigner = (signer: unknown): signer is Signer => {
  return (
    isDefined(signer) &&
    hasFunction(signer, "publicKey") &&
    hasFunction(signer, "sign") &&
    isEnvelopeSigner(signer) &&
    isAuthEntrySigner(signer)
  );
};
