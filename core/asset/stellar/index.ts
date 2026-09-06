import { Asset as NativeAsset, Operation, type xdr } from "stellar-sdk";
import { Server as NativeServer } from "stellar-sdk/rpc";
import {
  buildTrustlineLedgerKey,
  LedgerEntries,
} from "@/ledger-entries/index.ts";
import type {
  AccountLedgerEntry,
  TrustlineLedgerEntry,
} from "@/ledger-entries/types.ts";
import {
  type ClassicTransactionPipeline,
  createClassicTransactionPipeline,
} from "@/pipelines/classic-transaction/index.ts";
import type { ClassicTransactionOutput } from "@/pipelines/classic-transaction/types.ts";
import type { NetworkConfig } from "@/network/index.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";
import type {
  Asset,
  Server,
  StellarAssetArgs,
  StellarAssetChangeTrustArgs,
  StellarAssetClawbackArgs,
  StellarAssetSetTrustLineFlagsArgs,
  StellarAssetTransferArgs,
} from "@/asset/stellar/types.ts";
import * as E from "@/asset/stellar/error.ts";
import { ColibriError } from "@/error/index.ts";
import {
  formatStellarAssetAmount,
  parseStellarAssetAmount,
} from "@/asset/stellar/amount.ts";
import { StellarAssetContract } from "@/asset/sac/index.ts";
import {
  isStellarAssetCanonicalString,
  parseStellarAssetCanonicalString,
} from "@/asset/sep11/index.ts";
import type { StellarAssetCanonicalString } from "@/asset/sep11/types.ts";
import type {
  StellarAssetBalanceArgs,
  StellarAssetHolderState,
  StellarAssetIssueArgs,
  StellarAssetNetwork,
  StellarAssetRedeemArgs,
} from "@/asset/stellar/types.ts";

function resolveAsset(args: StellarAssetArgs): Asset {
  if ("asset" in args) return args.asset;
  if (args.issuer === "native") {
    const code: string = args.code;
    if (code !== "XLM") throw new E.NATIVE_ASSET_CODE_MISMATCH(code);
    return NativeAsset.native();
  }
  try {
    return new NativeAsset(args.code, args.issuer);
  } catch (cause) {
    throw new E.INVALID_ASSET(cause);
  }
}

function resolveRpc(args: StellarAssetArgs): Server {
  if (args.rpc) return args.rpc;
  if (!args.networkConfig.rpcUrl) throw new E.MISSING_RPC_URL();
  try {
    return new NativeServer(args.networkConfig.rpcUrl, {
      allowHttp: args.networkConfig.allowHttp ?? false,
    });
  } catch (cause) {
    throw new E.INVALID_RPC(cause);
  }
}

/**
 * Native Stellar asset account tooling, backed by the existing transaction pipe.
 *
 * Reads never submit transactions. Every write performs one explicit operation;
 * no method creates a trustline, changes issuer policy, or authorizes a holder as
 * a side effect of another action. Amounts and limits use decimal asset units.
 * The retained native `asset` remains usable in every Stellar SDK operation.
 */
export class StellarAsset {
  /** Native SDK asset bound to this instance. */
  readonly asset: Asset;
  /** Network used for transaction hashing and RPC reads. */
  readonly networkConfig: NetworkConfig;
  /** Native SDK server shared by the pipe and ledger reader. */
  readonly rpc: Server;
  /** Granular native ledger-entry reader for advanced account queries. */
  readonly ledgerEntries: LedgerEntries;
  /** Existing callable classic transaction pipeline; attach plugins here. */
  readonly transactionPipe: ClassicTransactionPipeline;

  /** Binds an asset and RPC connection without making a network request. */
  constructor(args: StellarAssetArgs) {
    this.asset = resolveAsset(args);
    this.networkConfig = args.networkConfig;
    this.rpc = resolveRpc(args);
    this.ledgerEntries = new LedgerEntries({ rpc: this.rpc });
    this.transactionPipe = createClassicTransactionPipeline({
      networkConfig: this.networkConfig,
      rpc: this.rpc,
    });
    for (const plugin of args.plugins?.transactionPipe ?? []) {
      this.transactionPipe.use(plugin);
    }
  }

  /** Creates a native XLM binding without network access or account setup. */
  static NativeXLM(args: StellarAssetNetwork): StellarAsset {
    return new StellarAsset({ ...args, asset: NativeAsset.native() });
  }

  /** Binds a SEP-11 `native` or `CODE:ISSUER` asset string. */
  static fromCanonical(
    { canonical, ...args }: StellarAssetNetwork & { canonical: string },
  ): StellarAsset {
    if (!isStellarAssetCanonicalString(canonical)) {
      throw new E.INVALID_CANONICAL_ASSET(canonical);
    }
    const { code, issuer } = parseStellarAssetCanonicalString(canonical);
    return new StellarAsset({ ...args, asset: new NativeAsset(code, issuer) });
  }

  /** Asset code; issuer-backed assets named XLM remain distinct from native XLM. */
  get code(): string {
    return this.asset.code;
  }
  /** Issuing account; native XLM has no issuer. */
  get issuer(): Ed25519PublicKey | undefined {
    return this.asset.issuer as Ed25519PublicKey | undefined;
  }
  /** Indicates native XLM rather than an issuer-backed asset. */
  isNative(): boolean {
    return this.asset.isNative();
  }
  /** The on-chain code, not an off-chain display name or identity endorsement. */
  symbol(): string {
    return this.code;
  }
  /** Native asset precision; does not require RPC or a deployed SAC. */
  decimals(): number {
    return 7;
  }
  /** Exact SEP-11 identity including the issuer when applicable. */
  toString(): StellarAssetCanonicalString {
    return this.isNative()
      ? "native"
      : `${this.code}:${this.issuer}` as StellarAssetCanonicalString;
  }
  /** Converts decimal native asset units to bigint smallest units without rounding. */
  parseAmount(amount: string): bigint {
    return parseStellarAssetAmount(amount);
  }
  /** Formats bigint native asset units as exact decimal text. */
  formatAmount(amount: bigint): string {
    return formatStellarAssetAmount(amount);
  }

  /**
   * Reads the actual native account or trustline holding this asset.
   * Missing state fails explicitly. An issuer has no finite balance of its own
   * issued asset; this is neither zero nor its XLM account balance.
   */
  async getHolderState(
    { id }: StellarAssetBalanceArgs,
  ): Promise<StellarAssetHolderState> {
    if (!this.isNative() && id === this.issuer) {
      throw new E.ISSUER_BALANCE_UNDEFINED();
    }
    try {
      if (this.isNative()) {
        return await this.ledgerEntries.account({ accountId: id });
      }
      const trustline = await this.getTrustline(id);
      if (!trustline) throw new E.BALANCE_TRUSTLINE_MISSING(id);
      return trustline;
    } catch (cause) {
      if (cause instanceof ColibriError) throw cause;
      throw new E.READ_HOLDER_STATE_FAILED(cause);
    }
  }

  /** Total balance in smallest units, not spendable balance after reserves/liabilities/fees. */
  async balance(args: StellarAssetBalanceArgs): Promise<bigint> {
    return (await this.getHolderState(args)).balance;
  }

  /** Full transfer authorization for an existing holding; preserves missing-state errors. */
  async authorized(args: StellarAssetBalanceArgs): Promise<boolean> {
    const state = await this.getHolderState(args);
    return state.type === "account" || state.flags.authorized;
  }

  /**
   * Creates a separate SAC client sharing this asset, network and native RPC.
   * This performs no deployment or simulation. Store the returned client when
   * attaching Soroban plugins; native pipeline plugins are not copied to it.
   */
  toContract(): StellarAssetContract {
    try {
      return StellarAssetContract.fromAsset({
        asset: this.asset,
        networkConfig: this.networkConfig,
        rpc: this.rpc,
      });
    } catch (cause) {
      throw new E.SAC_BINDING_FAILED(cause);
    }
  }

  /** Issues units by an explicit payment from the issuer; never changes holder authorization. */
  async issue(args: StellarAssetIssueArgs): Promise<ClassicTransactionOutput> {
    if (this.isNative()) throw new E.NATIVE_ISSUANCE();
    return await this.transfer({ ...args, source: this.issuer });
  }

  /** Redeems units by an explicit payment to the issuer; no trustline is removed. */
  async redeem(
    args: StellarAssetRedeemArgs,
  ): Promise<ClassicTransactionOutput> {
    if (this.isNative()) throw new E.NATIVE_REDEMPTION();
    return await this.transfer({ ...args, destination: this.issuer! });
  }

  /** Reads the issuer account and its protocol flags, or `null` for native XLM. */
  async getIssuer(): Promise<AccountLedgerEntry | null> {
    if (this.asset.isNative()) return null;
    try {
      return await this.ledgerEntries.account({
        accountId: this.asset.issuer as Ed25519PublicKey,
      });
    } catch (cause) {
      if (cause instanceof ColibriError) throw cause;
      throw new E.READ_ISSUER_FAILED(cause);
    }
  }

  /** Reads one known trustline, or `null` when absent (including native XLM). */
  async getTrustline(
    accountId: Ed25519PublicKey,
  ): Promise<TrustlineLedgerEntry | null> {
    if (this.asset.isNative()) return null;
    try {
      return await this.ledgerEntries.get(
        buildTrustlineLedgerKey({ accountId, asset: this.asset }),
      );
    } catch (cause) {
      if (cause instanceof ColibriError) throw cause;
      throw new E.READ_TRUSTLINE_FAILED(cause);
    }
  }

  /**
   * Creates, adjusts, or removes the source's trustline. `limit: "0"` requests
   * removal; the protocol rejects removal while balance or liabilities remain.
   * The operation source defaults to `config.source` before plugins execute.
   */
  async changeTrust(
    { config, ...args }: StellarAssetChangeTrustArgs,
  ): Promise<ClassicTransactionOutput> {
    if (this.asset.isNative()) throw new E.NATIVE_TRUSTLINE();
    let operation: xdr.Operation;
    try {
      operation = Operation.changeTrust({
        ...args,
        asset: this.asset,
        source: args.source ?? config.source,
      });
    } catch (cause) {
      throw new E.CHANGE_TRUST_FAILED(cause);
    }
    return await this.transactionPipe({ operations: [operation], config });
  }

  /**
   * Transfers this asset. Paying from its issuer issues units; paying to its
   * issuer redeems units. No trustlines or authorization flags are changed.
   */
  async transfer(
    { config, ...args }: StellarAssetTransferArgs,
  ): Promise<ClassicTransactionOutput> {
    let operation: xdr.Operation;
    try {
      operation = Operation.payment({
        ...args,
        asset: this.asset,
        source: args.source ?? config.source,
      });
    } catch (cause) {
      throw new E.TRANSFER_FAILED(cause);
    }
    return await this.transactionPipe({ operations: [operation], config });
  }

  /**
   * Explicitly changes a holder's authorization flags. The operation source
   * defaults to the issuer, independently of the envelope fee/sequence source.
   * This never enables account-wide issuer flags or trustline clawback support.
   */
  async setTrustLineFlags(
    { config, ...args }: StellarAssetSetTrustLineFlagsArgs,
  ): Promise<ClassicTransactionOutput> {
    if (this.asset.isNative()) throw new E.NATIVE_TRUSTLINE_FLAGS();
    let operation: xdr.Operation;
    try {
      operation = Operation.setTrustLineFlags({
        ...args,
        asset: this.asset,
        source: args.source ?? this.asset.issuer,
      });
    } catch (cause) {
      throw new E.TRUSTLINE_FLAGS_FAILED(cause);
    }
    return await this.transactionPipe({ operations: [operation], config });
  }

  /**
   * Claws back an explicitly selected amount from a holder. The protocol must
   * already permit clawback for that trustline; no policy flags are changed.
   * The operation source defaults to the issuer, not the transaction source.
   */
  async clawback(
    { config, ...args }: StellarAssetClawbackArgs,
  ): Promise<ClassicTransactionOutput> {
    if (this.asset.isNative()) throw new E.NATIVE_CLAWBACK();
    let operation: xdr.Operation;
    try {
      operation = Operation.clawback({
        ...args,
        asset: this.asset,
        source: args.source ?? this.asset.issuer,
      });
    } catch (cause) {
      throw new E.CLAWBACK_FAILED(cause);
    }
    return await this.transactionPipe({ operations: [operation], config });
  }
}

export type {
  StellarAssetArgs,
  StellarAssetBalanceArgs,
  StellarAssetChangeTrustArgs,
  StellarAssetClawbackArgs,
  StellarAssetHolderState,
  StellarAssetIssueArgs,
  StellarAssetNetwork,
  StellarAssetRedeemArgs,
  StellarAssetSetTrustLineFlagsArgs,
  StellarAssetTransferArgs,
} from "@/asset/stellar/types.ts";
