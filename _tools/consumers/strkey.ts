/** Public consumer regression for complete, precise StrKey declarations and runtime identity. */
import { Keypair, StrKey as NativeStrKey, xdr } from "stellar-sdk";
import {
  type ClaimableBalanceId,
  type ContractId,
  type Ed25519PublicKey,
  type Ed25519SecretKey,
  type LiquidityPoolId,
  type MuxedAddress,
  type PreAuthTx,
  type Sha256Hash,
  type SignedPayload,
  StrKey,
} from "@colibri/core";
import { StrKey as GranularStrKey } from "@colibri/core/strkey";

type Expected = {
  encodeContract: (
    ...args: Parameters<typeof NativeStrKey.encodeContract>
  ) => ContractId;
  decodeContract: typeof NativeStrKey.decodeContract;
  encodePreAuthTx: (
    ...args: Parameters<typeof NativeStrKey.encodePreAuthTx>
  ) => PreAuthTx;
  decodePreAuthTx: typeof NativeStrKey.decodePreAuthTx;
  encodeSha256Hash: (
    ...args: Parameters<typeof NativeStrKey.encodeSha256Hash>
  ) => Sha256Hash;
  decodeSha256Hash: typeof NativeStrKey.decodeSha256Hash;
  encodeSignedPayload: (
    ...args: Parameters<typeof NativeStrKey.encodeSignedPayload>
  ) => SignedPayload;
  decodeSignedPayload: typeof NativeStrKey.decodeSignedPayload;
  encodeLiquidityPool: (
    ...args: Parameters<typeof NativeStrKey.encodeLiquidityPool>
  ) => LiquidityPoolId;
  decodeLiquidityPool: typeof NativeStrKey.decodeLiquidityPool;
  encodeClaimableBalance: (
    ...args: Parameters<typeof NativeStrKey.encodeClaimableBalance>
  ) => ClaimableBalanceId;
  decodeClaimableBalance: typeof NativeStrKey.decodeClaimableBalance;
  encodeEd25519PublicKey: (
    ...args: Parameters<typeof NativeStrKey.encodeEd25519PublicKey>
  ) => Ed25519PublicKey;
  decodeEd25519PublicKey: typeof NativeStrKey.decodeEd25519PublicKey;
  encodeEd25519SecretSeed: (
    ...args: Parameters<typeof NativeStrKey.encodeEd25519SecretSeed>
  ) => Ed25519SecretKey;
  decodeEd25519SecretSeed: typeof NativeStrKey.decodeEd25519SecretSeed;
  encodeMed25519PublicKey: (
    ...args: Parameters<typeof NativeStrKey.encodeMed25519PublicKey>
  ) => MuxedAddress;
  decodeMed25519PublicKey: typeof NativeStrKey.decodeMed25519PublicKey;
};
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
// Exact equality rejects missing members, widened return types and accidental any.
export type RootContract = Assert<
  Equal<Pick<typeof StrKey, keyof Expected>, Expected>
>;
export type GranularContract = Assert<
  Equal<Pick<typeof GranularStrKey, keyof Expected>, Expected>
>;

/** Compile-time negative cases; deliberately never executed. */
export function invalidInputs(): void {
  // @ts-expect-error encodeContract must reject numbers, including in generated declarations.
  StrKey.encodeContract(123);
  // @ts-expect-error decodeContract must reject numbers, including in generated declarations.
  StrKey.decodeContract(123);
  // @ts-expect-error encodePreAuthTx must reject numbers, including in generated declarations.
  StrKey.encodePreAuthTx(123);
  // @ts-expect-error decodePreAuthTx must reject numbers, including in generated declarations.
  StrKey.decodePreAuthTx(123);
  // @ts-expect-error encodeSha256Hash must reject numbers, including in generated declarations.
  StrKey.encodeSha256Hash(123);
  // @ts-expect-error decodeSha256Hash must reject numbers, including in generated declarations.
  StrKey.decodeSha256Hash(123);
  // @ts-expect-error encodeSignedPayload must reject numbers, including in generated declarations.
  StrKey.encodeSignedPayload(123);
  // @ts-expect-error decodeSignedPayload must reject numbers, including in generated declarations.
  StrKey.decodeSignedPayload(123);
  // @ts-expect-error encodeLiquidityPool must reject numbers, including in generated declarations.
  StrKey.encodeLiquidityPool(123);
  // @ts-expect-error decodeLiquidityPool must reject numbers, including in generated declarations.
  StrKey.decodeLiquidityPool(123);
  // @ts-expect-error encodeClaimableBalance must reject numbers, including in generated declarations.
  StrKey.encodeClaimableBalance(123);
  // @ts-expect-error decodeClaimableBalance must reject numbers, including in generated declarations.
  StrKey.decodeClaimableBalance(123);
  // @ts-expect-error encodeEd25519PublicKey must reject numbers, including in generated declarations.
  StrKey.encodeEd25519PublicKey(123);
  // @ts-expect-error decodeEd25519PublicKey must reject numbers, including in generated declarations.
  StrKey.decodeEd25519PublicKey(123);
  // @ts-expect-error encodeEd25519SecretSeed must reject numbers, including in generated declarations.
  StrKey.encodeEd25519SecretSeed(123);
  // @ts-expect-error decodeEd25519SecretSeed must reject numbers, including in generated declarations.
  StrKey.decodeEd25519SecretSeed(123);
  // @ts-expect-error encodeMed25519PublicKey must reject numbers, including in generated declarations.
  StrKey.encodeMed25519PublicKey(123);
  // @ts-expect-error decodeMed25519PublicKey must reject numbers, including in generated declarations.
  StrKey.decodeMed25519PublicKey(123);
  // @ts-expect-error encodeContract must reject numbers, including in generated declarations.
  GranularStrKey.encodeContract(123);
  // @ts-expect-error decodeContract must reject numbers, including in generated declarations.
  GranularStrKey.decodeContract(123);
  // @ts-expect-error encodePreAuthTx must reject numbers, including in generated declarations.
  GranularStrKey.encodePreAuthTx(123);
  // @ts-expect-error decodePreAuthTx must reject numbers, including in generated declarations.
  GranularStrKey.decodePreAuthTx(123);
  // @ts-expect-error encodeSha256Hash must reject numbers, including in generated declarations.
  GranularStrKey.encodeSha256Hash(123);
  // @ts-expect-error decodeSha256Hash must reject numbers, including in generated declarations.
  GranularStrKey.decodeSha256Hash(123);
  // @ts-expect-error encodeSignedPayload must reject numbers, including in generated declarations.
  GranularStrKey.encodeSignedPayload(123);
  // @ts-expect-error decodeSignedPayload must reject numbers, including in generated declarations.
  GranularStrKey.decodeSignedPayload(123);
  // @ts-expect-error encodeLiquidityPool must reject numbers, including in generated declarations.
  GranularStrKey.encodeLiquidityPool(123);
  // @ts-expect-error decodeLiquidityPool must reject numbers, including in generated declarations.
  GranularStrKey.decodeLiquidityPool(123);
  // @ts-expect-error encodeClaimableBalance must reject numbers, including in generated declarations.
  GranularStrKey.encodeClaimableBalance(123);
  // @ts-expect-error decodeClaimableBalance must reject numbers, including in generated declarations.
  GranularStrKey.decodeClaimableBalance(123);
  // @ts-expect-error encodeEd25519PublicKey must reject numbers, including in generated declarations.
  GranularStrKey.encodeEd25519PublicKey(123);
  // @ts-expect-error decodeEd25519PublicKey must reject numbers, including in generated declarations.
  GranularStrKey.decodeEd25519PublicKey(123);
  // @ts-expect-error encodeEd25519SecretSeed must reject numbers, including in generated declarations.
  GranularStrKey.encodeEd25519SecretSeed(123);
  // @ts-expect-error decodeEd25519SecretSeed must reject numbers, including in generated declarations.
  GranularStrKey.decodeEd25519SecretSeed(123);
  // @ts-expect-error encodeMed25519PublicKey must reject numbers, including in generated declarations.
  GranularStrKey.encodeMed25519PublicKey(123);
  // @ts-expect-error decodeMed25519PublicKey must reject numbers, including in generated declarations.
  GranularStrKey.decodeMed25519PublicKey(123);
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
check(
  StrKey === GranularStrKey,
  "Root and granular StrKey must share identity",
);
const bytes = Keypair.random().rawPublicKey();
const signed = new xdr.SignerKeyEd25519SignedPayload({
  ed25519: bytes,
  payload: bytes.subarray(0, 3),
}).toXdr();
const muxed = new xdr.MuxedAccountMed25519({
  ed25519: bytes,
  id: xdr.Uint64.fromString("42"),
}).toXdr();
const claimable = new Uint8Array([0, ...bytes]);
for (const api of [StrKey, GranularStrKey]) {
  const cases = [
    [
      api.encodeContract,
      api.decodeContract,
      NativeStrKey.encodeContract,
      bytes,
    ],
    [
      api.encodePreAuthTx,
      api.decodePreAuthTx,
      NativeStrKey.encodePreAuthTx,
      bytes,
    ],
    [
      api.encodeSha256Hash,
      api.decodeSha256Hash,
      NativeStrKey.encodeSha256Hash,
      bytes,
    ],
    [
      api.encodeSignedPayload,
      api.decodeSignedPayload,
      NativeStrKey.encodeSignedPayload,
      signed,
    ],
    [
      api.encodeLiquidityPool,
      api.decodeLiquidityPool,
      NativeStrKey.encodeLiquidityPool,
      bytes,
    ],
    [
      api.encodeClaimableBalance,
      api.decodeClaimableBalance,
      NativeStrKey.encodeClaimableBalance,
      claimable,
    ],
    [
      api.encodeEd25519PublicKey,
      api.decodeEd25519PublicKey,
      NativeStrKey.encodeEd25519PublicKey,
      bytes,
    ],
    [
      api.encodeEd25519SecretSeed,
      api.decodeEd25519SecretSeed,
      NativeStrKey.encodeEd25519SecretSeed,
      bytes,
    ],
    [
      api.encodeMed25519PublicKey,
      api.decodeMed25519PublicKey,
      NativeStrKey.encodeMed25519PublicKey,
      muxed,
    ],
  ] as const;
  for (const [encode, decode, nativeEncode, raw] of cases) {
    const encoded = encode(raw);
    check(
      encoded === nativeEncode(raw),
      "StrKey must preserve Stellar SDK encoding",
    );
    const decoded = decode(encoded);
    check(
      decoded.length === raw.length &&
        decoded.every((byte, index) => byte === raw[index]),
      "StrKey must preserve round-trip bytes",
    );
  }
}
console.log(
  "StrKey consumer passed: 18 precise helpers, root/subpath identity and native round trips.",
);
