/**
 * Focused ledger APIs.
 * @module
 */
export * from "@/ledger-entries/index.ts";
import { Asset as NativeAsset } from "stellar-sdk/base";
/** @internal Native asset identity. */
type NativeAssetInstance = NativeAsset;
/** @internal Native asset constructor. */
type AssetConstructor = typeof NativeAsset;
/** Native SDK asset accepted by trustline readers. */
export type Asset = NativeAssetInstance;
/** Native SDK asset constructor, without a wrapper. */
export const Asset: AssetConstructor = NativeAsset;

// Shared public types are erased from JavaScript consumer bundles.
export type {
  BinaryData,
  ChangeTrustAssetString,
  ClaimableBalanceId,
  ContractId,
  CustomNetworkConfig,
  Ed25519PublicKey,
  FutureNetConfig,
  HorizonConfig,
  INetworkConfig,
  LiquidityPoolId,
  LiquidityPoolShareString,
  MainNetConfig,
  NetworkConfig,
  NetworkPassphrase,
  NetworkType,
  PreAuthTx,
  RPCConfig,
  Sha256Hash,
  SignedPayload,
  SorobanCodec,
  SorobanScValInput,
  SorobanValue,
  StellarAssetCanonicalString,
  TestNetConfig,
} from "@/types.ts";
