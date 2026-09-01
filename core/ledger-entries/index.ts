import { Server } from "stellar-sdk/rpc";
import type { Api } from "stellar-sdk/rpc";
import { Address, xdr } from "stellar-sdk";
import type { ExternalExecutableRef } from "stellar-sdk";
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
import { decodeLedgerEntryForKey } from "@/ledger-entries/decode.ts";
import { toBase64Xdr } from "@/ledger-entries/xdr.ts";
import type {
  AccountLedgerEntry,
  AnyLedgerEntry,
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
  ContractExecutableLedgerObservation,
  ContractExecutableView,
  ContractInstanceLedgerEntry,
  DataLedgerEntry,
  EntryFromLedgerKey,
  LedgerEntriesConstructorArgs,
  LedgerEntryKind,
  LiquidityPoolLedgerEntry,
  OfferLedgerEntry,
  ResolveContractExecutableArgs,
  ResolvedContractExecutable,
  RpcLedgerEntriesClient,
  TrustlineLedgerEntry,
} from "@/ledger-entries/types.ts";
import type { ContractId } from "@/strkeys/types.ts";

const normalizeExternalExecutableRef = (
  externalRef: ExternalExecutableRef,
): Extract<
  ContractExecutableView,
  { type: "externalRef" }
> => {
  try {
    const ref = externalRef instanceof xdr.ContractExecutableExternalRef
      ? externalRef
      : new xdr.ContractExecutableExternalRef({
        executableOwner: (externalRef.owner instanceof Address
          ? externalRef.owner
          : Address.fromString(externalRef.owner)).toScAddress(),
        tag: externalRef.tag,
      });

    return {
      type: "externalRef",
      executableOwner: Address.fromScAddress(ref.executableOwner).toString(),
      tag: Uint8Array.from(ref.tag.bytes),
    };
  } catch (cause) {
    throw new E.INVALID_EXTERNAL_REFERENCE(
      cause instanceof Error ? cause : new Error(String(cause)),
    );
  }
};

const isStellarAssetResolution = (
  resolved: ResolvedContractExecutable,
): resolved is Extract<
  ResolvedContractExecutable,
  { executable: { type: "stellarAsset" } }
> => resolved.executable.type === "stellarAsset";

export * from "@/ledger-entries/types.ts";
export * from "@/ledger-entries/keys.ts";

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
  ): Promise<
    { [Index in keyof TKeys]: EntryFromLedgerKey<TKeys[Index]> | null }
  > {
    const { entries: orderedEntries } = await this.queryMany(keys);

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

    const resolved = await this.resolveContractExecutable(args);
    if (isStellarAssetResolution(resolved)) {
      throw new E.CONTRACT_INSTANCE_HAS_NO_WASM_HASH(
        args.contractId,
        resolved.executable.type,
      );
    }
    return await this.requireEntry(
      "contractCode",
      buildContractCodeLedgerKey({
        hash: resolved.resolvedWasmHash,
      }),
    );
  }

  /**
   * Resolves the executable selected by a contract instance or external
   * reference at the current ledger.
   *
   * The returned value preserves an external reference's owner and exact tag
   * bytes alongside the Wasm hash observed at resolution time. Call this method
   * again when a caller intentionally needs to refresh a mutable mapping.
   */
  public async resolveContractExecutable(
    args: ResolveContractExecutableArgs,
  ): Promise<ResolvedContractExecutable> {
    if ("externalRef" in args && args.externalRef) {
      return await this.resolveExternalReference(
        normalizeExternalExecutableRef(args.externalRef),
      );
    }

    const key = buildContractInstanceLedgerKey({
      contractId: args.contractId,
    });
    const { entry: instance, observation } = await this.requireObservedEntry(
      "contractInstance",
      key,
    );
    const executable = instance.executable;

    if (executable.type === "externalRef") {
      return await this.resolveExternalReference(
        executable,
        args.contractId,
        observation,
      );
    }
    if (executable.type === "stellarAsset") {
      return {
        contractId: args.contractId,
        executable,
        instance: observation,
      };
    }

    return {
      contractId: args.contractId,
      executable,
      resolvedWasmHash: executable.wasmHash,
      instance: observation,
    };
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

  /** @internal */
  private async queryMany(
    keys: readonly LedgerKeyLike[],
  ): Promise<{
    entries: readonly (AnyLedgerEntry | null)[];
    latestLedger: number;
  }> {
    if (keys.length === 0) {
      return { entries: [], latestLedger: 0 };
    }

    for (const key of keys) {
      if (key.type === "ttl") {
        throw new E.UNSUPPORTED_RPC_LEDGER_KEY("ttl");
      }
    }

    const response = await this.rpc.getLedgerEntries(...keys);
    const entriesByKey = new Map(
      response.entries.map((entry) => [toBase64Xdr(entry.key), entry]),
    );
    const entries = keys.map((key) => {
      const entry = entriesByKey.get(toBase64Xdr(key));
      return entry
        ? decodeLedgerEntryForKey(
          key as xdr.LedgerKey,
          entry as Api.LedgerEntryResult,
        )
        : null;
    });

    return { entries, latestLedger: response.latestLedger };
  }

  /** @internal */
  private async requireObservedEntry<TKey extends LedgerKeyLike>(
    kind: LedgerEntryKind,
    key: TKey,
  ): Promise<{
    entry: EntryFromLedgerKey<TKey>;
    observation: {
      observedAtLedger: number;
      lastModifiedLedgerSeq?: number;
    };
  }> {
    const result = await this.queryMany([key]);
    const entry = result.entries[0] as EntryFromLedgerKey<TKey> | null;
    if (!entry) {
      throw new E.LEDGER_ENTRY_NOT_FOUND(kind, toBase64Xdr(key));
    }

    return {
      entry,
      observation: {
        observedAtLedger: result.latestLedger,
        lastModifiedLedgerSeq: entry.lastModifiedLedgerSeq,
      },
    };
  }

  /** @internal */
  private async resolveExternalReference(
    executable: Extract<
      ContractExecutableView,
      { type: "externalRef" }
    >,
    contractId?: ContractId,
    instance?: ContractExecutableLedgerObservation,
  ): Promise<ResolvedContractExecutable> {
    if (
      Address.fromString(executable.executableOwner).toScAddress().type !==
        "scAddressTypeContract"
    ) {
      throw new E.EXTERNAL_REFERENCE_OWNER_NOT_CONTRACT(
        executable.executableOwner,
      );
    }

    const key = buildContractDataLedgerKey({
      contractId: executable.executableOwner as ContractId,
      key: xdr.ScVal.scvExecutableTag(new xdr.XdrString(executable.tag)),
      durability: "persistent",
    });
    const result = await this.queryMany([key]);
    const reference = result.entries[0] as ContractDataLedgerEntry | null;
    if (!reference) {
      throw new E.EXTERNAL_REFERENCE_ENTRY_NOT_FOUND(
        executable.executableOwner,
        executable.tag,
      );
    }

    const value = reference.valueScVal as xdr.ScVal;
    const bytes = value.type === "scvBytes" ? value.bytes.toBytes() : undefined;
    if (!bytes || bytes.length !== 32) {
      throw new E.EXTERNAL_REFERENCE_VALUE_INVALID(
        executable.executableOwner,
        executable.tag,
        value.type,
        bytes?.length,
      );
    }

    return {
      contractId,
      executable,
      resolvedWasmHash: xdr.encodeBytes(bytes, "hex"),
      instance,
      reference: {
        observedAtLedger: result.latestLedger,
        lastModifiedLedgerSeq: reference.lastModifiedLedgerSeq,
      },
    };
  }
}
