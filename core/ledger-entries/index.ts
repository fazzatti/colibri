import { Buffer } from "buffer";
import { Server } from "stellar-sdk/rpc";
import type { Api } from "stellar-sdk/rpc";
import type { xdr } from "stellar-sdk";
import type { LedgerKeyLike } from "@/common/types/index.ts";
import * as E from "@/ledger-entries/error.ts";
import {
  buildAccountLedgerKey,
  buildClaimableBalanceLedgerKey,
  buildConfigSettingLedgerKey,
  buildContractCodeLedgerKey,
  buildContractDataLedgerKey,
  buildContractInstanceLedgerKey,
  buildDataLedgerKey,
  buildLiquidityPoolLedgerKey,
  buildOfferLedgerKey,
  buildTrustlineLedgerKey,
} from "@/ledger-entries/keys.ts";
import {
  decodeLedgerEntryForKey,
  detectLedgerEntryKindFromKey,
} from "@/ledger-entries/decode.ts";
import type {
  AccountLedgerEntry,
  BuildAccountLedgerKeyArgs,
  BuildClaimableBalanceLedgerKeyArgs,
  BuildConfigSettingLedgerKeyArgs,
  BuildContractDataLedgerKeyArgs,
  BuildContractInstanceLedgerKeyArgs,
  BuildDataLedgerKeyArgs,
  BuildLiquidityPoolLedgerKeyArgs,
  BuildOfferLedgerKeyArgs,
  BuildTrustlineLedgerKeyArgs,
  ClaimableBalanceLedgerEntry,
  ConfigSettingLedgerEntry,
  ContractCodeLedgerEntry,
  ContractCodeLookupArgs,
  ContractDataLedgerEntry,
  ContractInstanceLedgerEntry,
  DataLedgerEntry,
  EntryFromLedgerKey,
  LedgerEntriesConstructorArgs,
  LedgerEntryKind,
  LiquidityPoolLedgerEntry,
  OfferLedgerEntry,
  RpcLedgerEntriesClient,
  TrustlineLedgerEntry,
} from "@/ledger-entries/types.ts";

export * from "@/ledger-entries/types.ts";
export * from "@/ledger-entries/keys.ts";

const BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function decodeByteFormBase64(value: Uint8Array): string | null {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(value);
    if (
      BASE64_REGEX.test(decoded) &&
      Buffer.from(decoded, "base64").toString("base64") === decoded
    ) {
      return decoded;
    }
  } catch {
    // Fall through and treat the payload as raw XDR bytes.
  }

  return null;
}

function toBase64Xdr(key: LedgerKeyLike): string {
  const encoded = key.toXDR("base64");
  if (typeof encoded === "string") {
    return encoded;
  }

  const byteFormBase64 = decodeByteFormBase64(encoded);
  return byteFormBase64 ?? Buffer.from(encoded).toString("base64");
}

/**
 * High-level RPC helper for reading and decoding Stellar ledger entries.
 */
export class LedgerEntries {
  /** Bound RPC client used for all ledger-entry reads. */
  readonly rpc: RpcLedgerEntriesClient;

  /**
   * Creates a ledger-entry reader bound to either a network config or RPC client.
   */
  constructor(args: LedgerEntriesConstructorArgs) {
    const hasNetworkConfig = "networkConfig" in args && !!args.networkConfig;
    const hasRpc = "rpc" in args && !!args.rpc;

    if (hasNetworkConfig === hasRpc) {
      throw new E.INVALID_CONSTRUCTOR_ARGS();
    }

    if (hasRpc) {
      this.rpc = args.rpc;
      return;
    }

    if (!args.networkConfig.rpcUrl) {
      throw new E.MISSING_RPC_URL();
    }

    this.rpc = new Server(args.networkConfig.rpcUrl, {
      allowHttp: args.networkConfig.allowHttp ?? false,
    }) as RpcLedgerEntriesClient;
  }

  /**
   * Fetches and decodes a single ledger entry, returning `null` when missing.
   */
  public async get<TKey extends LedgerKeyLike>(
    key: TKey,
  ): Promise<EntryFromLedgerKey<TKey> | null> {
    const entries = await this.getMany([key] as const);
    return entries[0] as EntryFromLedgerKey<TKey> | null;
  }

  /**
   * Fetches and decodes multiple ledger entries while preserving input order.
   */
  public async getMany<const TKeys extends readonly LedgerKeyLike[]>(
    keys: TKeys,
  ): Promise<{ [Index in keyof TKeys]: EntryFromLedgerKey<TKeys[Index]> | null }> {
    if (keys.length === 0) {
      return [] as {
        [Index in keyof TKeys]: EntryFromLedgerKey<TKeys[Index]> | null;
      };
    }

    for (const key of keys) {
      const kind = detectLedgerEntryKindFromKey(key as xdr.LedgerKey);
      if (kind === "ttl") {
        throw new E.UNSUPPORTED_RPC_LEDGER_KEY(kind);
      }
    }

    const response = await this.rpc.getLedgerEntries(...keys);
    const entriesByKey = new Map(
      response.entries.map((entry) => [
        toBase64Xdr(entry.key),
        entry,
      ]),
    );

    const orderedEntries = keys.map((key) => {
      const entry = entriesByKey.get(toBase64Xdr(key));
      return entry
        ? decodeLedgerEntryForKey(
          key as xdr.LedgerKey,
          entry as Api.LedgerEntryResult,
        )
        : null;
    });

    return orderedEntries as {
      [Index in keyof TKeys]: EntryFromLedgerKey<TKeys[Index]> | null;
    };
  }

  /**
   * Reads a native account entry by account id.
   */
  public async account(
    args: BuildAccountLedgerKeyArgs,
  ): Promise<AccountLedgerEntry> {
    return await this.requireEntry("account", buildAccountLedgerKey(args));
  }

  /**
   * Reads a trustline entry by owner account and asset.
   */
  public async trustline(
    args: BuildTrustlineLedgerKeyArgs,
  ): Promise<TrustlineLedgerEntry> {
    return await this.requireEntry("trustline", buildTrustlineLedgerKey(args));
  }

  /**
   * Reads an offer entry by seller id and offer id.
   */
  public async offer(args: BuildOfferLedgerKeyArgs): Promise<OfferLedgerEntry> {
    return await this.requireEntry("offer", buildOfferLedgerKey(args));
  }

  /**
   * Reads a manage-data entry by account id and data name.
   */
  public async data(args: BuildDataLedgerKeyArgs): Promise<DataLedgerEntry> {
    return await this.requireEntry("data", buildDataLedgerKey(args));
  }

  /**
   * Reads a claimable-balance entry by balance id.
   */
  public async claimableBalance(
    args: BuildClaimableBalanceLedgerKeyArgs,
  ): Promise<ClaimableBalanceLedgerEntry> {
    return await this.requireEntry(
      "claimableBalance",
      buildClaimableBalanceLedgerKey(args),
    );
  }

  /**
   * Reads a liquidity-pool entry by pool id.
   */
  public async liquidityPool(
    args: BuildLiquidityPoolLedgerKeyArgs,
  ): Promise<LiquidityPoolLedgerEntry> {
    return await this.requireEntry(
      "liquidityPool",
      buildLiquidityPoolLedgerKey(args),
    );
  }

  /**
   * Reads a generic contract-data entry.
   */
  public async contractData(
    args: BuildContractDataLedgerKeyArgs,
  ): Promise<ContractDataLedgerEntry> {
    return await this.requireEntry(
      "contractData",
      buildContractDataLedgerKey(args),
    );
  }

  /**
   * Reads a contract-instance entry.
   */
  public async contractInstance(
    args: BuildContractInstanceLedgerKeyArgs,
  ): Promise<ContractInstanceLedgerEntry> {
    return await this.requireEntry(
      "contractInstance",
      buildContractInstanceLedgerKey(args),
    );
  }

  /**
   * Reads a contract-code entry by hash or by resolving a contract instance first.
   */
  public async contractCode(
    args: ContractCodeLookupArgs,
  ): Promise<ContractCodeLedgerEntry> {
    if ("hash" in args) {
      return await this.requireEntry(
        "contractCode",
        buildContractCodeLedgerKey(args),
      );
    }

    const contractInstance = await this.contractInstance(args);
    if (contractInstance.executable.type !== "wasm") {
      throw new E.CONTRACT_INSTANCE_HAS_NO_WASM_HASH(
        args.contractId,
        contractInstance.executable.type,
      );
    }

    return await this.requireEntry(
      "contractCode",
      buildContractCodeLedgerKey({
        hash: contractInstance.executable.wasmHash,
      }),
    );
  }

  /**
   * Reads a config-setting entry.
   */
  public async configSetting(
    args: BuildConfigSettingLedgerKeyArgs,
  ): Promise<ConfigSettingLedgerEntry> {
    return await this.requireEntry(
      "configSetting",
      buildConfigSettingLedgerKey(args),
    );
  }

  /**
   * Reads a required entry and raises a typed not-found error when missing.
   */
  private async requireEntry<TKey extends LedgerKeyLike>(
    kind: LedgerEntryKind,
    key: TKey,
  ): Promise<EntryFromLedgerKey<TKey>> {
    const entry = await this.get(key);
    if (!entry) {
      throw new E.LEDGER_ENTRY_NOT_FOUND(
        kind,
        toBase64Xdr(key),
      );
    }

    return entry as EntryFromLedgerKey<TKey>;
  }
}
