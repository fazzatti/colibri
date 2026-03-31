/** Leading character used by each supported Stellar StrKey type. */
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

/** Human-readable StrKey names keyed by their prefix. */
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

/** Ed25519 public key encoded as a Stellar StrKey. */
export type Ed25519PublicKey = `G${string}`;
/** Ed25519 secret seed encoded as a Stellar StrKey. */
export type Ed25519SecretKey = `S${string}`;
/** M-address representing a muxed account. */
export type MuxedAddress = `M${string}`;
/** Pre-authorized transaction hash encoded as a StrKey. */
export type PreAuthTx = `T${string}`;
/** SHA-256 hash encoded as a StrKey. */
export type Sha256Hash = `X${string}`;
/** Signed payload encoded as a StrKey. */
export type SignedPayload = `P${string}`;
/** Soroban contract id encoded as a StrKey. */
export type ContractId = `C${string}`;
/** Liquidity pool id encoded as a StrKey. */
export type LiquidityPoolId = `L${string}`;
/** Claimable balance id encoded as a StrKey. */
export type ClaimableBalanceId = `B${string}`;

/** Maps each StrKey prefix to its corresponding branded string type. */
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
