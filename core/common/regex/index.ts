// STRKEYS REGEX
const ed25519PublicKey = /^G[A-Z2-7]{55}$/;
const ed25519SecretKey = /^S[A-Z2-7]{55}$/;
const muxedAddress = /^M[A-Z2-7]{68}$/;
const contractId = /^C[A-Z2-7]{55}$/;
const med25519PublicKey = /^M[A-Z2-7]{68}$/;
const preAuthTx = /^T[A-Z2-7]{55}$/;
const sha256Hash = /^X[A-Z2-7]{55}$/;
const signedPayload = /^P[A-Z2-7]{55,164}$/;
const liquidityPool = /^L[A-Z2-7]{55}$/;
const claimableBalance = /^B[A-Z2-7]{57}$/;

// OTHER REGEX
const wasmHash = /^[a-f0-9]{64}$/;
const uint64String = /^(?:0|[1-9]\d{0,19})$/;
const eventId = /^\d{19}-\d{10}$/;
const alphanumeric = /^[a-zA-Z0-9]+$/;

export const regex = {
  ed25519PublicKey,
  ed25519SecretKey,
  muxedAddress,
  contractId,
  med25519PublicKey,
  preAuthTx,
  sha256Hash,
  signedPayload,
  liquidityPool,
  claimableBalance,
  wasmHash,
  uint64String,
  eventId,
  alphanumeric,
};
