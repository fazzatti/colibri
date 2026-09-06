import type {
  Asset as NativeAsset,
  LiquidityPoolAsset as NativeLiquidityPoolAsset,
  Operation as NativeOperation,
  xdr,
} from "stellar-sdk";
import type { Server as NativeServer } from "stellar-sdk/rpc";
import type { NetworkConfig } from "@/network/index.ts";
import type { ClassicTransactionPipelinePlugins } from "@/pipelines/classic-transaction/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type {
  LiquidityPoolLedgerEntry,
  TrustlineLedgerEntry,
} from "@/ledger-entries/types.ts";
import type { StellarPriceRatio } from "@/price/types.ts";

/** @internal Exact native SDK asset type. */
export type Asset = NativeAsset;
/** @internal Exact native SDK pool-share asset type. */
export type LiquidityPoolAsset = NativeLiquidityPoolAsset;
/** @internal Exact native SDK RPC type. */
export type Server = NativeServer;
/** @internal Exact native SDK operation type. */
export type Operation = xdr.Operation;
/** @internal Exact required native SDK deposit options. */
type DepositOptions = NonNullable<
  Parameters<typeof NativeOperation.liquidityPoolDeposit>[0]
>;
/** @internal Exact required native SDK withdrawal options. */
type WithdrawOptions = NonNullable<
  Parameters<typeof NativeOperation.liquidityPoolWithdraw>[0]
>;

/** Configuration for a protocol-native constant-product liquidity pool. */
export type NativeLiquidityPoolArgs = {
  /** Plugins attached to the owned transaction pipe during construction. */
  plugins?: ClassicTransactionPipelinePlugins;
  /** Two different native SDK assets; Colibri applies canonical ordering. */
  assets: readonly [Asset, Asset];
  /** Network used by the owned transaction pipeline. */
  networkConfig: NetworkConfig;
  /** Optional existing native SDK RPC client. */
  rpc?: Server;
};

/** Explicit pool-share trustline change. A zero limit removes the trustline. */
export type PoolChangeTrustArgs = {
  /** Maximum pool shares in decimal units; omitted uses the SDK maximum. */
  limit?: string;
  /** Optional operation source, independent from transaction source. */
  source?: string;
};

/** Native SDK deposit options with the pool identity supplied by the instance. */
export type PoolDepositArgs = Omit<
  DepositOptions,
  "liquidityPoolId"
>;
/** Native SDK withdrawal options with the pool identity supplied by the instance. */
export type PoolWithdrawArgs = Omit<
  WithdrawOptions,
  "liquidityPoolId"
>;
/** A native operation input plus the existing Colibri transaction configuration. */
export type PoolTransaction<T> = T & {
  /** Source, signers, fee and timeout for the owned transaction pipeline. */
  config: TransactionConfig;
};
/** Pool state together with the ledger at which the RPC observed it. */
export type NativeLiquidityPoolState = LiquidityPoolLedgerEntry & {
  /** Latest ledger from the same RPC response, not a separate observation. */
  observedAtLedger: number;
};
/** An amount labelled with its native SDK asset, independent of A/B ordering. */
export type PoolAssetAmount = {
  /** One of this pool's two assets. */
  asset: Asset;
  /** Decimal asset units (not integer stroops). */
  amount: string;
};
/** Asset-labelled deposit amounts; prices retain the native A/B direction. */
export type PoolDepositByAssetArgs =
  & Omit<PoolDepositArgs, "maxAmountA" | "maxAmountB">
  & {
    /** Exactly one maximum for each asset, in either order. */
    maximumAmounts: readonly [PoolAssetAmount, PoolAssetAmount];
  };
/** Asset-labelled withdrawal minimums. */
export type PoolWithdrawByAssetArgs =
  & Omit<PoolWithdrawArgs, "minAmountA" | "minAmountB">
  & {
    /** Exactly one minimum for each asset, in either order. */
    minimumAmounts: readonly [PoolAssetAmount, PoolAssetAmount];
  };

/** A price interval stated explicitly as quote units per one base unit. */
export type PoolPriceBoundsArgs = {
  /** One of the two pool assets, whose quantity is one. */
  baseAsset: Asset;
  /** The other pool asset, in which prices are expressed. */
  quoteAsset: Asset;
  /** Inclusive minimum, as exact decimal text or a native-compatible fraction. */
  minimum: string | StellarPriceRatio;
  /** Inclusive maximum in the same direction. */
  maximum: string | StellarPriceRatio;
};
/** Exact native A/B bounds, suitable for spreading into a deposit input. */
export type PoolPriceBounds = {
  minPrice: StellarPriceRatio;
  maxPrice: StellarPriceRatio;
};
/** A holder and the pool read together in one RPC observation. */
export type NativeLiquidityPoolPosition = {
  /** Native decoded pool reserves and total share supply. */
  pool: LiquidityPoolLedgerEntry;
  /** Holder's pool-share trustline, including liabilities and limit. */
  trustline: TrustlineLedgerEntry;
  /** Exact ownership fraction, or null while total supply is zero. Not a withdrawal quote. */
  ownership: { shares: bigint; totalShares: bigint } | null;
  /** Latest ledger reported by the single RPC response containing both entries. */
  observedAtLedger: number;
};
