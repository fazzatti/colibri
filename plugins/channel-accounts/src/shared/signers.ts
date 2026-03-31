import type { Signer } from "@colibri/core";

export const appendUniqueSigners = (
  signers: readonly Signer[],
  ...extraSigners: readonly Signer[]
): Signer[] => {
  const signerMap = new Map(
    signers.map((signer) => [signer.publicKey(), signer]),
  );

  for (const signer of extraSigners) {
    signerMap.set(signer.publicKey(), signer);
  }

  return Array.from(signerMap.values());
};
