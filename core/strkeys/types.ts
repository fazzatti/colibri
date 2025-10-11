export enum StrkeyPrefix {
  Ed25519PublicKey = "G",
  Ed25519SecretKey = "S",
  Med25519PublicKey = "M",
  PreAuthTx = "T",
  Sha256Hash = "X",
  SignedPayload = "P",
  ContractId = "C",
  LiquidityPoolId = "L",
  ClaimableBalanceId = "B",
}

export enum StrkeyName {
  G = "ed25519PublicKey",
  S = "ed25519SecretKey",
  M = "med25519PublicKey",
  T = "preAuthTx",
  X = "sha256Hash",
  P = "signedPayload",
  C = "contract",
  L = "liquidityPool",
  B = "claimableBalance",
}

export type Ed25519PublicKey = `G${string}`;
export type Ed25519SecretKey = `S${string}`;
export type MuxedAddress = `M${string}`;
export type PreAuthTx = `T${string}`;
export type Sha256Hash = `X${string}`;
export type SignedPayload = `P${string}`;
export type ContractId = `C${string}`;
export type LiquidityPoolId = `L${string}`;
export type ClaimableBalanceId = `B${string}`;

export type StrkeyType = {
  [StrkeyPrefix.ClaimableBalanceId]: ClaimableBalanceId;
  [StrkeyPrefix.ContractId]: ContractId;
  [StrkeyPrefix.Ed25519PublicKey]: Ed25519PublicKey;
  [StrkeyPrefix.Ed25519SecretKey]: Ed25519SecretKey;
  [StrkeyPrefix.Med25519PublicKey]: MuxedAddress;
  [StrkeyPrefix.SignedPayload]: SignedPayload;
  [StrkeyPrefix.PreAuthTx]: PreAuthTx;
  [StrkeyPrefix.Sha256Hash]: Sha256Hash;
  [StrkeyPrefix.LiquidityPoolId]: LiquidityPoolId;
};
