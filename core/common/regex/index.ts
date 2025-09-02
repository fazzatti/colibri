const ed25519PublicKey = /^G[A-Z2-7]{55}$/;
const muxedAddress = /^M[A-Z2-7]{68}$/;
const contractId = /^C[A-Z0-9]{55}$/;
const wasmHash = /^[a-f0-9]{64}$/;

export const regex = {
  ed25519PublicKey,
  muxedAddress,
  contractId,
  wasmHash,
};
