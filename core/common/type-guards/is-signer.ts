import type { Signer } from "@/signer/types.ts";
import { isDefined } from "@/common/index.ts";
import { hasFunction } from "@/common/type-guards/has-function.ts";

/** Returns `true` when the value satisfies Colibri's signer contract. */
export const isSigner = (signer: unknown): signer is Signer => {
  return (
    isDefined(signer) &&
    hasFunction(signer, "publicKey") &&
    hasFunction(signer, "sign") &&
    hasFunction(signer, "signTransaction") &&
    hasFunction(signer, "signSorobanAuthEntry") &&
    hasFunction(signer, "signsFor")
  );
};
