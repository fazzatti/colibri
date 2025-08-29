const ed25519PublicKey = /^G[A-Z2-7]{55}$/;
const contractId = /^C[A-Z0-9]{55}$/;
const wasmHash = /^[a-f0-9]{64}$/;

export const regex = {
  ed25519PublicKey,
  contractId,
  wasmHash,
};
