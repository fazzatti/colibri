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
  StellarAssetChangeTrustArgs,
  StellarAssetClawbackArgs,
  StellarAssetSetTrustLineFlagsArgs,
  StellarAssetTransferArgs,
} from "@/asset/stellar/types.ts";
