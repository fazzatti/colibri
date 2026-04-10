/**
 * Helpers to facilitate handling the Strkeys specified in SEP-23
 * https://github.com/stellar-protocol/blob/master/ecosystem/sep-0023.md
 */
import { StrKey as StellarSdkStrKey } from "stellar-sdk";
import { regex } from "@/common/regex/index.ts";
import type {
  ClaimableBalanceId,
  ContractId,
  Ed25519PublicKey,
  Ed25519SecretKey,
  LiquidityPoolId,
  MuxedAddress,
  PreAuthTx,
  Sha256Hash,
  SignedPayload,
} from "@/strkeys/types.ts";
import { StrkeyPrefix, StrkeyName } from "@/strkeys/types.ts";

const StrkeyRegex: Record<StrkeyPrefix, RegExp> = {} as Record<
  StrkeyPrefix,
  RegExp
>;

StrkeyRegex[StrkeyPrefix.Ed25519PublicKey] = regex.ed25519PublicKey;
StrkeyRegex[StrkeyPrefix.Ed25519SecretKey] = regex.ed25519SecretKey;
StrkeyRegex[StrkeyPrefix.Med25519PublicKey] = regex.med25519PublicKey;
StrkeyRegex[StrkeyPrefix.PreAuthTx] = regex.preAuthTx;
StrkeyRegex[StrkeyPrefix.Sha256Hash] = regex.sha256Hash;
StrkeyRegex[StrkeyPrefix.SignedPayload] = regex.signedPayload;
StrkeyRegex[StrkeyPrefix.ContractId] = regex.contractId;
StrkeyRegex[StrkeyPrefix.LiquidityPoolId] = regex.liquidityPool;
StrkeyRegex[StrkeyPrefix.ClaimableBalanceId] = regex.claimableBalance;

function getStrkeyTypeName(
  prefix: StrkeyPrefix | keyof typeof StrkeyPrefix
): string {
  return StrkeyName[prefix as keyof typeof StrkeyName];
}

function detectStrkeyType(strkey: string): StrkeyName | null {
  const prefix = strkey[0] as keyof typeof StrkeyName;
  if (prefix in StrkeyName) {
    return StrkeyName[prefix];
  }
  return null;
}

// Type guards with regex validation (Tier 1: Quick format check)

/**
 * Checks if a string matches the Ed25519 public key strkey format (G...).
 * Performs regex-based format validation only. Does not verify checksum.
 * Use `isValidEd25519PublicKey()` for full validation.
 */
function isEd25519PublicKey(value: string): value is Ed25519PublicKey {
  return StrkeyRegex[StrkeyPrefix.Ed25519PublicKey].test(value);
}

/**
 * Checks if a string matches the Ed25519 secret seed strkey format (S...).
 * Performs regex-based format validation only. Does not verify checksum.
 * Use `isValidEd25519SecretSeed()` for full validation.
 */
function isEd25519SecretKey(value: string): value is Ed25519SecretKey {
  return StrkeyRegex[StrkeyPrefix.Ed25519SecretKey].test(value);
}

/**
 * Checks if a string matches the muxed address strkey format (M...).
 * Performs regex-based format validation only. Does not verify checksum.
 * Use `isValidMuxedAddress()` for full validation.
 */
function isMuxedAddress(value: string): value is MuxedAddress {
  return StrkeyRegex[StrkeyPrefix.Med25519PublicKey].test(value);
}

/**
 * Checks if a string matches the pre-authorized transaction strkey format (T...).
 * Performs regex-based format validation only. Does not verify checksum.
 */
function isPreAuthTx(value: string): value is PreAuthTx {
  return StrkeyRegex[StrkeyPrefix.PreAuthTx].test(value);
}

/**
 * Checks if a string matches the SHA256 hash strkey format (X...).
 * Performs regex-based format validation only. Does not verify checksum.
 */
function isSha256Hash(value: string): value is Sha256Hash {
  return StrkeyRegex[StrkeyPrefix.Sha256Hash].test(value);
}

/**
 * Checks if a string matches the signed payload strkey format (P...).
 * Performs regex-based format validation only. Does not verify checksum.
 * Use `isValidSignedPayload()` for full validation.
 */
function isSignedPayload(value: string): value is SignedPayload {
  return StrkeyRegex[StrkeyPrefix.SignedPayload].test(value);
}

/**
 * Checks if a string matches the contract ID strkey format (C...).
 * Performs regex-based format validation only. Does not verify checksum.
 * Use `isValidContractId()` for full validation.
 */
function isContractId(value: string): value is ContractId {
  return StrkeyRegex[StrkeyPrefix.ContractId].test(value);
}

/**
 * Checks if a string matches the liquidity pool ID strkey format (L...).
 * Performs regex-based format validation only. Does not verify checksum.
 * Use `isValidLiquidityPoolId()` for full validation.
 */
function isLiquidityPoolId(value: string): value is LiquidityPoolId {
  return StrkeyRegex[StrkeyPrefix.LiquidityPoolId].test(value);
}

/**
 * Checks if a string matches the claimable balance ID strkey format (B...).
 * Performs regex-based format validation only. Does not verify checksum.
 * Use `isValidClaimableBalanceId()` for full validation.
 */
function isClaimableBalanceId(value: string): value is ClaimableBalanceId {
  return StrkeyRegex[StrkeyPrefix.ClaimableBalanceId].test(value);
}

// Tier 2: Full validation with checksum verification

/**
 * Validates an Ed25519 public key strkey (G...) with checksum verification.
 * Performs format check (regex) and checksum verification (CRC16).
 */
function isValidEd25519PublicKey(value: string): value is Ed25519PublicKey {
  if (!isEd25519PublicKey(value)) return false;
  return StellarSdkStrKey.isValidEd25519PublicKey(value);
}

/**
 * Validates an Ed25519 secret seed strkey (S...) with checksum verification.
 * Performs format check (regex) and checksum verification (CRC16).
 */
function isValidEd25519SecretSeed(value: string): value is Ed25519SecretKey {
  if (!isEd25519SecretKey(value)) return false;
  return StellarSdkStrKey.isValidEd25519SecretSeed(value);
}

/**
 * Validates a muxed account strkey (M...) with checksum verification.
 * Performs format check (regex) and checksum verification (CRC16).
 */
function isValidMuxedAddress(value: string): value is MuxedAddress {
  if (!isMuxedAddress(value)) return false;
  return StellarSdkStrKey.isValidMed25519PublicKey(value);
}

/**
 * Validates a signed payload strkey (P...) with checksum verification.
 * Performs format check (regex) and checksum verification (CRC16).
 *
 * Known limitations from Stellar SDK:
 * - Does not verify length prefix consistency
 * - Does not verify zero-padding for payloads under 64 bytes
 */
function isValidSignedPayload(value: string): value is SignedPayload {
  if (!isSignedPayload(value)) return false;
  return StellarSdkStrKey.isValidSignedPayload(value);
}

/**
 * Validates a contract ID strkey (C...) with checksum verification.
 * Performs format check (regex) and checksum verification (CRC16).
 */
function isValidContractId(value: string): value is ContractId {
  if (!isContractId(value)) return false;
  return StellarSdkStrKey.isValidContract(value);
}

/**
 * Validates a liquidity pool ID strkey (L...) with checksum verification.
 * Performs format check (regex) and checksum verification (CRC16).
 */
function isValidLiquidityPoolId(value: string): value is LiquidityPoolId {
  if (!isLiquidityPoolId(value)) return false;
  return StellarSdkStrKey.isValidLiquidityPool(value);
}

/**
 * Validates a claimable balance ID strkey (B...) with checksum verification.
 * Performs format check (regex) and checksum verification (CRC16).
 *
 * Known limitation from Stellar SDK:
 * - Does not verify the first byte is 0x00 (type discriminant for V0)
 */
function isValidClaimableBalanceId(value: string): value is ClaimableBalanceId {
  if (!isClaimableBalanceId(value)) return false;
  return StellarSdkStrKey.isValidClaimableBalance(value);
}

const stellarSdkStr = {
  encodeContract: ((...args: Parameters<typeof StellarSdkStrKey.encodeContract>) =>
    StellarSdkStrKey.encodeContract(...args) as ContractId),
  decodeContract: StellarSdkStrKey.decodeContract,
  encodePreAuthTx: ((...args: Parameters<typeof StellarSdkStrKey.encodePreAuthTx>) =>
    StellarSdkStrKey.encodePreAuthTx(...args) as PreAuthTx),
  decodePreAuthTx: StellarSdkStrKey.decodePreAuthTx,
  encodeSha256Hash: ((...args: Parameters<typeof StellarSdkStrKey.encodeSha256Hash>) =>
    StellarSdkStrKey.encodeSha256Hash(...args) as Sha256Hash),
  decodeSha256Hash: StellarSdkStrKey.decodeSha256Hash,
  encodeSignedPayload: ((...args: Parameters<typeof StellarSdkStrKey.encodeSignedPayload>) =>
    StellarSdkStrKey.encodeSignedPayload(...args) as SignedPayload),
  decodeSignedPayload: StellarSdkStrKey.decodeSignedPayload,
  encodeLiquidityPool: ((...args: Parameters<typeof StellarSdkStrKey.encodeLiquidityPool>) =>
    StellarSdkStrKey.encodeLiquidityPool(...args) as LiquidityPoolId),
  decodeLiquidityPool: StellarSdkStrKey.decodeLiquidityPool,
  encodeClaimableBalance: ((...args: Parameters<typeof StellarSdkStrKey.encodeClaimableBalance>) =>
    StellarSdkStrKey.encodeClaimableBalance(...args) as ClaimableBalanceId),
  decodeClaimableBalance: StellarSdkStrKey.decodeClaimableBalance,
  encodeEd25519PublicKey: ((
    ...args: Parameters<typeof StellarSdkStrKey.encodeEd25519PublicKey>
  ) => StellarSdkStrKey.encodeEd25519PublicKey(...args) as Ed25519PublicKey),
  decodeEd25519PublicKey: StellarSdkStrKey.decodeEd25519PublicKey,
  encodeEd25519SecretSeed: ((
    ...args: Parameters<typeof StellarSdkStrKey.encodeEd25519SecretSeed>
  ) => StellarSdkStrKey.encodeEd25519SecretSeed(...args) as Ed25519SecretKey),
  decodeEd25519SecretSeed: StellarSdkStrKey.decodeEd25519SecretSeed,
  encodeMed25519PublicKey: ((
    ...args: Parameters<typeof StellarSdkStrKey.encodeMed25519PublicKey>
  ) => StellarSdkStrKey.encodeMed25519PublicKey(...args) as MuxedAddress),
  decodeMed25519PublicKey: StellarSdkStrKey.decodeMed25519PublicKey,
};

/** StrKey validation, detection, and encoding helpers. */
export const StrKey = {
  ...stellarSdkStr, // Re-exporting from stellar-sdk for full validation

  regex: StrkeyRegex,
  getStrkeyTypeName,
  detectStrkeyType,
  isEd25519PublicKey,
  isEd25519SecretKey,
  isMuxedAddress,
  isPreAuthTx,
  isSha256Hash,
  isSignedPayload,
  isContractId,
  isLiquidityPoolId,
  isClaimableBalanceId,
  isValidEd25519PublicKey,
  isValidEd25519SecretSeed,
  isValidMuxedAddress,
  isValidSignedPayload,
  isValidContractId,
  isValidLiquidityPoolId,
  isValidClaimableBalanceId,
};
