import type { Asset as SdkAsset, Operation } from "stellar-sdk";
import type { Server as SdkServer } from "stellar-sdk/rpc";
import type { NetworkConfig } from "@/network/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

/** @internal Native Stellar SDK asset, without a Colibri wrapper. */
type Asset = SdkAsset;
/** @internal Native RPC server alias for JSR declarations. */
type Server = SdkServer;
/** @internal Exact native sell-operation options. */
type SellOptions = Parameters<typeof Operation.manageSellOffer>[0];
/** @internal Exact native buy-operation options. */
type BuyOptions = Parameters<typeof Operation.manageBuyOffer>[0];
/** @internal Exact native passive-operation options. */
type PassiveOptions = Parameters<typeof Operation.createPassiveSellOffer>[0];

/** Network and optional native RPC server used by SDEX reads and writes. */
export type SDEXConstructorArgs = {
  networkConfig: NetworkConfig;
  rpc?: Server;
};

/** Creates a new offer using the SDK's buying-per-selling price convention. */
export type CreateSellOfferArgs = Omit<SellOptions, "offerId"> & {
  /** Explicit transaction source, signers, fees and timeout. */
  config: TransactionConfig;
};

/** Updates an existing offer; zero amount retains the native cancellation behavior. */
export type UpdateSellOfferArgs = CreateSellOfferArgs & {
  /** Existing positive offer ID. */
  offerId: string;
};

/** Creates a new offer using the SDK's selling-per-buying price convention. */
export type CreateBuyOfferArgs = Omit<BuyOptions, "offerId"> & {
  /** Explicit transaction source, signers, fees and timeout. */
  config: TransactionConfig;
};

/** Updates an existing offer using a target buying amount. */
export type UpdateBuyOfferArgs = CreateBuyOfferArgs & {
  /** Existing positive offer ID. */
  offerId: string;
};

/** Creates an offer that does not consume an equally priced counter-offer. */
export type CreatePassiveSellOfferArgs =
  & PassiveOptions
  & {
    /** Transaction authorization and fee settings. */ config:
      TransactionConfig;
  };

/** Identity of one known offer; this does not discover or list a market. */
export type GetOfferArgs = {
  /** G address owning the offer. */
  seller: Ed25519PublicKey;
  /** Existing offer ID. Use string/bigint for large IDs; number must be a safe integer. */
  offerId: bigint | number | string;
};

/** Cancels a known offer, using its seller as the explicit operation source. */
export type CancelOfferArgs = GetOfferArgs & {
  /** Transaction config must authorize the seller even when the fee source differs. */
  config: TransactionConfig;
};

/** Plain-language sell limit; does not promise any fill or exclude partial fills. */
export type SellArgs = {
  /** Native SDK asset to sell. */
  asset: Asset;
  /** Maximum quantity of `asset` offered, in decimal asset units. */
  amount: string;
  /** Native SDK asset received if the offer trades. */
  receive: Asset;
  /** Minimum units of `receive` per one unit of `asset`; exact decimal string. */
  minimumReceivePerUnit: string;
  /** Optional operation source, independently from transaction config.source. */
  source?: string;
  /** Transaction authorization and fee settings. */
  config: TransactionConfig;
};

/** Plain-language buy limit; does not promise any fill or exclude partial fills. */
export type BuyArgs = {
  /** Native SDK asset to buy. */
  asset: Asset;
  /** Maximum quantity of `asset` requested, in decimal asset units. */
  amount: string;
  /** Native SDK asset spent if the offer trades. */
  payWith: Asset;
  /** Maximum units of `payWith` per one unit of `asset`; exact decimal string. */
  maximumSpendPerUnit: string;
  /** Optional operation source, independently from transaction config.source. */
  source?: string;
  /** Transaction authorization and fee settings. */
  config: TransactionConfig;
};
