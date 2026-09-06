import {
  Asset,
  getLiquidityPoolId,
  LiquidityPoolAsset,
  LiquidityPoolId as NativeLiquidityPoolId,
  Operation,
  xdr,
} from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { StrKey } from "@/strkeys/index.ts";
import type { Ed25519PublicKey, LiquidityPoolId } from "@/strkeys/types.ts";
import {
  type ClassicTransactionPipeline,
  createClassicTransactionPipeline,
} from "@/pipelines/classic-transaction/index.ts";
import type { ClassicTransactionOutput } from "@/pipelines/classic-transaction/types.ts";
import {
  buildLiquidityPoolLedgerKey,
  buildTrustlineLedgerKey,
  LedgerEntries,
} from "@/ledger-entries/index.ts";
import { decodeLedgerEntryForKey } from "@/ledger-entries/decode.ts";
import type {
  LiquidityPoolLedgerEntry,
  TrustlineLedgerEntry,
} from "@/ledger-entries/types.ts";
import { StellarPrice } from "@/price/index.ts";
import type { NetworkConfig } from "@/network/index.ts";
import { ColibriError } from "@/error/index.ts";
import * as E from "@/liquidity-pool/error.ts";
import type {
  Asset as AssetType,
  LiquidityPoolAsset as PoolShareAsset,
  NativeLiquidityPoolArgs,
  NativeLiquidityPoolPosition,
  NativeLiquidityPoolState,
  Operation as NativeOperation,
  PoolAssetAmount,
  PoolChangeTrustArgs,
  PoolDepositArgs,
  PoolDepositByAssetArgs,
  PoolPriceBounds,
  PoolPriceBoundsArgs,
  PoolTransaction,
  PoolWithdrawArgs,
  PoolWithdrawByAssetArgs,
  Server as RpcServer,
} from "@/liquidity-pool/types.ts";

/**
 * Explicit actions on a Stellar protocol-native constant-product pool.
 *
 * Native means protocol-native, not XLM-only. Every transaction method executes
 * through `transactionPipe`. Operation builders remain available for batching.
 * Nothing implicitly establishes trustlines or chooses price tolerance.
 */
export class NativeLiquidityPool {
  private readonly shareAsset: LiquidityPoolAsset;
  private readonly idHex: string;
  /** Pool identifier encoded as an L-prefixed StrKey for ledger reads. */
  readonly poolId: LiquidityPoolId;
  /** Network shared by reads and the owned transaction pipeline. */
  readonly networkConfig: NetworkConfig;
  /** Native RPC instance, reused unchanged when supplied. */
  readonly rpc: RpcServer;
  /** Owned callable pipeline; attach existing transaction plugins here. */
  readonly transactionPipe: ClassicTransactionPipeline;
  /** Typed ledger-entry reader bound to the same RPC. */
  readonly ledgerEntries: LedgerEntries;

  /** Creates a pool binding without deploying, funding or changing trustlines. */
  constructor(
    { assets, networkConfig, rpc, plugins }: NativeLiquidityPoolArgs,
  ) {
    try {
      const [first, second] = assets.map((asset) =>
        Asset.fromOperation(asset.toXdrObject())
      );
      const [a, b] = Asset.compare(first, second) < 0
        ? [first, second]
        : [second, first];
      this.shareAsset = new LiquidityPoolAsset(a, b, 30);
      const bytes = getLiquidityPoolId(
        "constant_product",
        this.shareAsset.getLiquidityPoolParameters(),
      );
      this.poolId = StrKey.encodeLiquidityPool(bytes);
      this.idHex = xdr.encodeBytes(bytes, "hex");
    } catch (cause) {
      throw new E.INVALID_ASSET_PAIR(cause);
    }
    this.networkConfig = networkConfig;
    try {
      this.rpc = rpc ??
        new Server(networkConfig.rpcUrl!, {
          allowHttp: networkConfig.allowHttp,
        });
    } catch (cause) {
      throw new E.FAILED_TO_CREATE_RPC(cause);
    }
    this.ledgerEntries = new LedgerEntries({ rpc: this.rpc });
    this.transactionPipe = createClassicTransactionPipeline({
      networkConfig,
      rpc: this.rpc,
    });
    for (const plugin of plugins?.transactionPipe ?? []) {
      this.transactionPipe.use(plugin);
    }
  }

  /** First asset in canonical protocol order, returned as a native SDK copy. */
  get assetA(): AssetType {
    return Asset.fromOperation(this.shareAsset.assetA.toXdrObject());
  }
  /** Second asset in canonical protocol order, returned as a native SDK copy. */
  get assetB(): AssetType {
    return Asset.fromOperation(this.shareAsset.assetB.toXdrObject());
  }
  /** Native SDK pool-share asset suitable for `Operation.changeTrust`. */
  get poolShareAsset(): PoolShareAsset {
    return new LiquidityPoolAsset(this.assetA, this.assetB, 30);
  }

  /**
   * Converts asset-labelled prices to canonical A/B bounds. When the direction
   * is reversed, inverts and swaps the endpoints. No price tolerance is added.
   */
  priceBounds(
    { baseAsset, quoteAsset, minimum, maximum }: PoolPriceBoundsArgs,
  ): PoolPriceBounds {
    const canonical = baseAsset.equals(this.assetB) &&
      quoteAsset.equals(this.assetA);
    const reversed = baseAsset.equals(this.assetA) &&
      quoteAsset.equals(this.assetB);
    if (!canonical && !reversed) throw new E.INVALID_PRICE_ASSETS();
    const min = typeof minimum === "string"
      ? StellarPrice.fromDecimal(minimum)
      : minimum;
    const max = typeof maximum === "string"
      ? StellarPrice.fromDecimal(maximum)
      : maximum;
    if (StellarPrice.compare(min, max) > 0) throw new E.REVERSED_PRICE_BOUNDS();
    return canonical ? { minPrice: { ...min }, maxPrice: { ...max } } : {
      minPrice: StellarPrice.invert(max),
      maxPrice: StellarPrice.invert(min),
    };
  }

  /**
   * Reads a holder's shares and pool reserves in one RPC request. No percentage
   * is rounded, and the ownership fraction is not a promised redemption amount.
   * Both entries must exist; an absent holding is not silently reported as zero.
   */
  async getPosition(
    account: Ed25519PublicKey,
  ): Promise<NativeLiquidityPoolPosition> {
    const poolKey = buildLiquidityPoolLedgerKey({
      liquidityPoolId: this.poolId,
    });
    const trustKey = buildTrustlineLedgerKey({
      accountId: account,
      asset: new NativeLiquidityPoolId(this.idHex),
    });
    try {
      const response = await this.rpc.getLedgerEntries(poolKey, trustKey);
      const entries = new Map(
        response.entries.map((entry) => [entry.key.toXdr("base64"), entry]),
      );
      const poolEntry = entries.get(poolKey.toXdr("base64"));
      const trustEntry = entries.get(trustKey.toXdr("base64"));
      if (!poolEntry) throw new E.POSITION_POOL_MISSING();
      if (!trustEntry) throw new E.POSITION_TRUSTLINE_MISSING();
      const pool = decodeLedgerEntryForKey(
        poolKey,
        poolEntry,
      ) as LiquidityPoolLedgerEntry;
      const trustline = decodeLedgerEntryForKey(
        trustKey,
        trustEntry,
      ) as TrustlineLedgerEntry;
      return {
        pool,
        trustline,
        ownership: pool.totalPoolShares === 0n
          ? null
          : { shares: trustline.balance, totalShares: pool.totalPoolShares },
        observedAtLedger: response.latestLedger,
      };
    } catch (cause) {
      if (cause instanceof ColibriError) throw cause;
      throw new E.FAILED_TO_READ_POSITION(cause);
    }
  }

  /** Reads reserves/shares in integer 10^-7 units and retains the observation ledger. */
  async getState(): Promise<NativeLiquidityPoolState> {
    let response;
    const key = buildLiquidityPoolLedgerKey({ liquidityPoolId: this.poolId });
    try {
      response = await this.rpc.getLedgerEntries(key);
      if (response.entries.length > 0) {
        return {
          ...decodeLedgerEntryForKey(key, response.entries[0]),
          observedAtLedger: response.latestLedger,
        } as NativeLiquidityPoolState;
      }
    } catch (cause) {
      throw new E.FAILED_TO_READ_POOL(cause);
    }
    throw new E.POOL_NOT_FOUND();
  }

  /** Reads an existing pool-share trustline; a missing trustline raises a ledger error. */
  async getTrustline(account: Ed25519PublicKey): Promise<TrustlineLedgerEntry> {
    try {
      return await this.ledgerEntries.trustline({
        accountId: account,
        asset: new NativeLiquidityPoolId(this.idHex),
      });
    } catch (cause) {
      if (cause instanceof ColibriError) throw cause;
      throw new E.FAILED_TO_READ_TRUSTLINE(cause);
    }
  }

  /** Builds exactly one native pool-share trustline change, without submitting. */
  changeTrustOperation(args: PoolChangeTrustArgs): NativeOperation {
    try {
      return Operation.changeTrust({ ...args, asset: this.poolShareAsset });
    } catch (cause) {
      throw new E.FAILED_TO_BUILD_TRUSTLINE(cause);
    }
  }
  /** Builds exactly one deposit. Native price bounds are amount A divided by amount B. */
  depositOperation(args: PoolDepositArgs): NativeOperation {
    try {
      return Operation.liquidityPoolDeposit({
        ...args,
        liquidityPoolId: this.idHex,
      });
    } catch (cause) {
      throw new E.FAILED_TO_BUILD_DEPOSIT(cause);
    }
  }
  /** Builds exactly one withdrawal, with caller-selected minimum received amounts. */
  withdrawOperation(args: PoolWithdrawArgs): NativeOperation {
    try {
      return Operation.liquidityPoolWithdraw({
        ...args,
        liquidityPoolId: this.idHex,
      });
    } catch (cause) {
      throw new E.FAILED_TO_BUILD_WITHDRAWAL(cause);
    }
  }
  /** Creates, adjusts or removes a pool-share trustline through the owned pipeline. */
  async changeTrust(
    { config, ...args }: PoolTransaction<PoolChangeTrustArgs>,
  ): Promise<ClassicTransactionOutput> {
    const operation = this.changeTrustOperation({
      ...args,
      source: args.source ?? config.source,
    });
    return await this.transactionPipe({ operations: [operation], config });
  }
  /** Deposits through the owned pipeline; trustlines must already be established. */
  async deposit(
    { config, ...args }: PoolTransaction<PoolDepositArgs>,
  ): Promise<ClassicTransactionOutput> {
    const operation = this.depositOperation({
      ...args,
      source: args.source ?? config.source,
    });
    return await this.transactionPipe({ operations: [operation], config });
  }
  /** Withdraws through the owned pipeline; never automatically closes trustlines. */
  async withdraw(
    { config, ...args }: PoolTransaction<PoolWithdrawArgs>,
  ): Promise<ClassicTransactionOutput> {
    const operation = this.withdrawOperation({
      ...args,
      source: args.source ?? config.source,
    });
    return await this.transactionPipe({ operations: [operation], config });
  }

  /** Resolves one amount for each canonical asset without modifying the input. */
  private orderedAmounts(
    amounts: readonly PoolAssetAmount[],
  ): readonly [string, string] | null {
    if (amounts.length !== 2) return null;
    const a = amounts.find((item) => item.asset.equals(this.shareAsset.assetA));
    const b = amounts.find((item) => item.asset.equals(this.shareAsset.assetB));
    return a && b ? [a.amount, b.amount] : null;
  }
  /** Deposits with maximums labelled by asset; native A/B price direction is unchanged. */
  depositByAsset(
    { maximumAmounts, ...args }: PoolTransaction<PoolDepositByAssetArgs>,
  ): Promise<ClassicTransactionOutput> {
    const amounts = this.orderedAmounts(maximumAmounts);
    if (!amounts) throw new E.INVALID_DEPOSIT_ASSETS();
    return this.deposit({
      ...args,
      maxAmountA: amounts[0],
      maxAmountB: amounts[1],
    });
  }
  /** Withdraws with minimum received amounts labelled by asset instead of A/B. */
  withdrawByAsset(
    { minimumAmounts, ...args }: PoolTransaction<PoolWithdrawByAssetArgs>,
  ): Promise<ClassicTransactionOutput> {
    const amounts = this.orderedAmounts(minimumAmounts);
    if (!amounts) throw new E.INVALID_WITHDRAWAL_ASSETS();
    return this.withdraw({
      ...args,
      minAmountA: amounts[0],
      minAmountB: amounts[1],
    });
  }
}

/** Error constructors for native pool operations. */
export const ERRORS_NATIVE_LIQUIDITY_POOL: typeof E = E;
export type {
  NativeLiquidityPoolArgs,
  NativeLiquidityPoolPosition,
  NativeLiquidityPoolState,
  PoolAssetAmount,
  PoolChangeTrustArgs,
  PoolDepositArgs,
  PoolDepositByAssetArgs,
  PoolPriceBounds,
  PoolPriceBoundsArgs,
  PoolTransaction,
  PoolWithdrawArgs,
  PoolWithdrawByAssetArgs,
} from "@/liquidity-pool/types.ts";
