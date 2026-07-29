import type { Signer, TransactionSigner } from "@colibri/core";

export const appendUniqueSigners = <TSigner extends TransactionSigner>(
  signers: readonly TSigner[],
  ...extraSigners: readonly Signer[]
): Array<TSigner | Signer> => {
  const signersWithoutPublicKey = signers.filter(
    (signer) =>
      !("publicKey" in signer) || typeof signer.publicKey !== "function",
  );
  const signerMap = new Map<string, TSigner | Signer>(
    signers
      .filter(
        (signer): signer is TSigner & Signer =>
          "publicKey" in signer && typeof signer.publicKey === "function",
      )
      .map((signer) => [signer.publicKey(), signer]),
  );

  for (const signer of extraSigners) {
    signerMap.set(signer.publicKey(), signer);
  }

  return [...signersWithoutPublicKey, ...signerMap.values()];
};
