import type { KeypairSigner, Signer } from "@colibri/core";

type SignerWithPublicKey = Signer & Pick<KeypairSigner, "publicKey">;

export const appendUniqueSigners = (
  signers: readonly Signer[],
  ...extraSigners: readonly KeypairSigner[]
): Signer[] => {
  const signersWithoutPublicKey = signers.filter(
    (signer) =>
      !("publicKey" in signer) || typeof signer.publicKey !== "function",
  );
  const signerMap = new Map<string, Signer>(
    signers
      .filter(
        (signer): signer is SignerWithPublicKey =>
          "publicKey" in signer && typeof signer.publicKey === "function",
      )
      .map((signer) => [signer.publicKey(), signer]),
  );

  for (const signer of extraSigners) {
    signerMap.set(signer.publicKey(), signer);
  }

  return [...signersWithoutPublicKey, ...signerMap.values()];
};
