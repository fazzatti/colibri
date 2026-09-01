import { Address, hash, Keypair, xdr } from "stellar-sdk";
import type { BinaryData, LedgerKeyLike } from "@/common/types/index.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";
import { StrKey } from "@/strkeys/index.ts";
import * as E from "@/ledger-entries/error.ts";
import { toRawXdrBytes } from "@/ledger-entries/xdr.ts";
import type {
  AccountLedgerEntry,
  AccountLedgerKey,
  AnyLedgerEntry,
  BuildAccountLedgerKeyArgs,
  BuildClaimableBalanceLedgerKeyArgs,
  BuildConfigSettingLedgerKeyArgs,
  BuildContractCodeLedgerKeyArgs,
  BuildContractDataLedgerKeyArgs,
  BuildContractInstanceLedgerKeyArgs,
  BuildDataLedgerKeyArgs,
  BuildLiquidityPoolLedgerKeyArgs,
  BuildOfferLedgerKeyArgs,
  BuildTrustlineLedgerKeyArgs,
  BuildTtlLedgerKeyArgs,
  ClaimableBalanceLedgerEntry,
  ClaimableBalanceLedgerKey,
  ConfigSettingIdName,
  ConfigSettingLedgerEntry,
  ConfigSettingLedgerKey,
  ContractCodeLedgerEntry,
  ContractCodeLedgerKey,
  ContractDataDurabilityName,
  ContractDataLedgerEntry,
  ContractDataLedgerKey,
  ContractInstanceLedgerEntry,
  ContractInstanceLedgerKey,
  DataLedgerEntry,
  DataLedgerKey,
  LiquidityPoolLedgerEntry,
  LiquidityPoolLedgerKey,
  OfferLedgerEntry,
  OfferLedgerKey,
  TrustlineLedgerEntry,
  TrustlineLedgerKey,
  TtlLedgerEntry,
  TtlLedgerKey,
  TypedLedgerKey,
} from "@/ledger-entries/types.ts";
import type { Sha256Hash } from "@/strkeys/types.ts";

const HEX_32_BYTE_REGEX = /^[0-9a-f]{64}$/i;
const MAX_SIGNED_INT64 = 9_223_372_036_854_775_807n;

const CONFIG_SETTING_IDS: Record<
  ConfigSettingIdName,
  xdr.ConfigSettingId
> = {
  configSettingContractMaxSizeBytes:
    xdr.ConfigSettingId.configSettingContractMaxSizeBytes,
  configSettingContractComputeV0:
    xdr.ConfigSettingId.configSettingContractComputeV0,
  configSettingContractLedgerCostV0:
    xdr.ConfigSettingId.configSettingContractLedgerCostV0,
  configSettingContractHistoricalDataV0:
    xdr.ConfigSettingId.configSettingContractHistoricalDataV0,
  configSettingContractEventsV0:
    xdr.ConfigSettingId.configSettingContractEventsV0,
  configSettingContractBandwidthV0:
    xdr.ConfigSettingId.configSettingContractBandwidthV0,
  configSettingContractCostParamsCpuInstructions:
    xdr.ConfigSettingId.configSettingContractCostParamsCpuInstructions,
  configSettingContractCostParamsMemoryBytes:
    xdr.ConfigSettingId.configSettingContractCostParamsMemoryBytes,
  configSettingContractDataKeySizeBytes:
    xdr.ConfigSettingId.configSettingContractDataKeySizeBytes,
  configSettingContractDataEntrySizeBytes:
    xdr.ConfigSettingId.configSettingContractDataEntrySizeBytes,
  configSettingStateArchival: xdr.ConfigSettingId.configSettingStateArchival,
  configSettingContractExecutionLanes:
    xdr.ConfigSettingId.configSettingContractExecutionLanes,
  configSettingLiveSorobanStateSizeWindow:
    xdr.ConfigSettingId.configSettingLiveSorobanStateSizeWindow,
  configSettingEvictionIterator:
    xdr.ConfigSettingId.configSettingEvictionIterator,
  configSettingContractParallelComputeV0:
    xdr.ConfigSettingId.configSettingContractParallelComputeV0,
  configSettingContractLedgerCostExtV0:
    xdr.ConfigSettingId.configSettingContractLedgerCostExtV0,
  configSettingScpTiming: xdr.ConfigSettingId.configSettingScpTiming,
};

function brandLedgerKey<
  TEntry extends AnyLedgerEntry,
  TKey extends xdr.LedgerKey,
>(key: TKey): TypedLedgerKey<TEntry, TKey> {
  return key as TypedLedgerKey<TEntry, TKey>;
}

function requireAccountId(accountId: string): void {
  if (!StrKey.isValidEd25519PublicKey(accountId)) {
    throw new E.INVALID_ACCOUNT_ID(accountId);
  }
}

function normalizeOfferId(offerId: bigint | number | string): xdr.Int64 {
  let parsed: bigint;

  if (typeof offerId === "bigint") {
    parsed = offerId;
  } else if (typeof offerId === "number") {
    if (!Number.isInteger(offerId)) {
      throw new E.INVALID_OFFER_ID(offerId);
    }

    parsed = BigInt(offerId);
  } else {
    if (!/^\d+$/.test(offerId)) {
      throw new E.INVALID_OFFER_ID(offerId);
    }

    parsed = BigInt(offerId);
  }

  if (parsed < 0n || parsed > MAX_SIGNED_INT64) {
    throw new E.INVALID_OFFER_ID(offerId);
  }

  return xdr.Int64.fromString(parsed.toString());
}

function requireContractId(contractId: string): void {
  if (!StrKey.isValidContractId(contractId)) {
    throw new E.INVALID_CONTRACT_ID(contractId);
  }
}

function requireClaimableBalanceId(balanceId: string): void {
  if (!StrKey.isValidClaimableBalanceId(balanceId)) {
    throw new E.INVALID_CLAIMABLE_BALANCE_ID(balanceId);
  }
}

function requireLiquidityPoolId(liquidityPoolId: string): void {
  if (!StrKey.isValidLiquidityPoolId(liquidityPoolId)) {
    throw new E.INVALID_LIQUIDITY_POOL_ID(liquidityPoolId);
  }
}

function normalizeHashBytes(hashValue: string | BinaryData): Uint8Array {
  if (typeof hashValue === "string") {
    if (!HEX_32_BYTE_REGEX.test(hashValue)) {
      throw new E.INVALID_HEX_HASH(hashValue);
    }
    return xdr.decodeBytes(hashValue, "hex");
  }

  const hashBytes = toUint8Array(hashValue);
  if (hashBytes.length !== 32) {
    throw new E.INVALID_HEX_HASH(xdr.encodeBytes(hashBytes, "hex"));
  }

  return hashBytes;
}

function normalizeContractDataDurability(
  durability?: ContractDataDurabilityName,
): xdr.ContractDataDurability {
  if (!durability || durability === "persistent") {
    return xdr.ContractDataDurability.persistent;
  }

  return xdr.ContractDataDurability.temporary;
}

function normalizeConfigSettingId(
  configSettingId: ConfigSettingIdName,
): xdr.ConfigSettingId {
  const value = CONFIG_SETTING_IDS[configSettingId];
  if (!value) {
    throw new E.INVALID_CONFIG_SETTING_ID(configSettingId);
  }

  return value;
}

function normalizeClaimableBalanceId(
  balanceId: string,
): xdr.ClaimableBalanceId {
  const decoded = StrKey.decodeClaimableBalance(balanceId);
  return xdr.ClaimableBalanceId.claimableBalanceIdTypeV0(decoded.subarray(1));
}

function normalizeLedgerKeyHash(
  args: BuildTtlLedgerKeyArgs,
): Uint8Array {
  if ("key" in args && args.key) {
    return hash(toRawXdrBytes(args.key));
  }

  if (typeof args.keyHash === "string") {
    try {
      return StrKey.decodeSha256Hash(args.keyHash);
    } catch (_) {
      throw new E.INVALID_LEDGER_KEY_HASH();
    }
  }

  const keyHash = toUint8Array(args.keyHash);
  if (keyHash.length !== 32) {
    throw new E.INVALID_LEDGER_KEY_HASH();
  }

  return keyHash;
}

/**
 * Computes the hash used by TTL ledger keys for an existing ledger key.
 */
export function hashLedgerKey(key: LedgerKeyLike): Sha256Hash {
  return StrKey.encodeSha256Hash(hash(toRawXdrBytes(key)));
}

/**
 * Builds an account ledger key branded with the decoded account-entry type.
 */
export function buildAccountLedgerKey({
  accountId,
}: BuildAccountLedgerKeyArgs): AccountLedgerKey {
  requireAccountId(accountId);

  return brandLedgerKey<AccountLedgerEntry, xdr.LedgerKeyAccountArm>(
    xdr.LedgerKey.account(
      new xdr.LedgerKeyAccount({
        accountId: Keypair.fromPublicKey(accountId).xdrAccountId(),
      }),
    ),
  );
}

/**
 * Builds a trustline ledger key branded with the decoded trustline-entry type.
 */
export function buildTrustlineLedgerKey({
  accountId,
  asset,
}: BuildTrustlineLedgerKeyArgs): TrustlineLedgerKey {
  requireAccountId(accountId);

  return brandLedgerKey<TrustlineLedgerEntry, xdr.LedgerKeyTrustline>(
    xdr.LedgerKey.trustline(
      new xdr.LedgerKeyTrustLine({
        accountId: Keypair.fromPublicKey(accountId).xdrAccountId(),
        asset: asset.toTrustLineXdrObject() as xdr.TrustLineAsset,
      }),
    ),
  );
}

/**
 * Builds an offer ledger key branded with the decoded offer-entry type.
 */
export function buildOfferLedgerKey({
  sellerId,
  offerId,
}: BuildOfferLedgerKeyArgs): OfferLedgerKey {
  requireAccountId(sellerId);

  return brandLedgerKey<OfferLedgerEntry, xdr.LedgerKeyOfferArm>(
    xdr.LedgerKey.offer(
      new xdr.LedgerKeyOffer({
        sellerId: Keypair.fromPublicKey(sellerId).xdrAccountId(),
        offerId: normalizeOfferId(offerId),
      }),
    ),
  );
}

/**
 * Builds a data-entry ledger key branded with the decoded data-entry type.
 */
export function buildDataLedgerKey({
  accountId,
  dataName,
}: BuildDataLedgerKeyArgs): DataLedgerKey {
  requireAccountId(accountId);

  return brandLedgerKey<DataLedgerEntry, xdr.LedgerKeyDataArm>(
    xdr.LedgerKey.data(
      new xdr.LedgerKeyData({
        accountId: Keypair.fromPublicKey(accountId).xdrAccountId(),
        dataName: typeof dataName === "string"
          ? dataName
          : toUint8Array(dataName),
      }),
    ),
  );
}

/**
 * Builds a claimable-balance ledger key branded with the decoded entry type.
 */
export function buildClaimableBalanceLedgerKey({
  balanceId,
}: BuildClaimableBalanceLedgerKeyArgs): ClaimableBalanceLedgerKey {
  requireClaimableBalanceId(balanceId);

  return brandLedgerKey<
    ClaimableBalanceLedgerEntry,
    xdr.LedgerKeyClaimableBalanceArm
  >(
    xdr.LedgerKey.claimableBalance(
      new xdr.LedgerKeyClaimableBalance({
        balanceId: normalizeClaimableBalanceId(balanceId),
      }),
    ),
  );
}

/**
 * Builds a liquidity-pool ledger key branded with the decoded entry type.
 */
export function buildLiquidityPoolLedgerKey({
  liquidityPoolId,
}: BuildLiquidityPoolLedgerKeyArgs): LiquidityPoolLedgerKey {
  requireLiquidityPoolId(liquidityPoolId);

  return brandLedgerKey<
    LiquidityPoolLedgerEntry,
    xdr.LedgerKeyLiquidityPoolArm
  >(
    xdr.LedgerKey.liquidityPool(
      new xdr.LedgerKeyLiquidityPool({
        liquidityPoolId: new xdr.PoolId(
          StrKey.decodeLiquidityPool(liquidityPoolId),
        ),
      }),
    ),
  );
}

/**
 * Builds a generic contract-data ledger key branded with the decoded entry type.
 */
export function buildContractDataLedgerKey({
  contractId,
  key,
  durability,
}: BuildContractDataLedgerKeyArgs): ContractDataLedgerKey {
  requireContractId(contractId);

  return brandLedgerKey<
    ContractDataLedgerEntry,
    xdr.LedgerKeyContractDataArm
  >(
    xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: Address.fromString(contractId).toScAddress(),
        key,
        durability: normalizeContractDataDurability(durability),
      }),
    ),
  );
}

/**
 * Builds a contract-instance ledger key branded with the decoded entry type.
 */
export function buildContractInstanceLedgerKey({
  contractId,
}: BuildContractInstanceLedgerKeyArgs): ContractInstanceLedgerKey {
  requireContractId(contractId);

  return brandLedgerKey<
    ContractInstanceLedgerEntry,
    xdr.LedgerKeyContractDataArm
  >(
    xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: new Address(contractId).toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent,
      }),
    ),
  );
}

/**
 * Builds a contract-code ledger key branded with the decoded entry type.
 */
export function buildContractCodeLedgerKey({
  hash,
}: BuildContractCodeLedgerKeyArgs): ContractCodeLedgerKey {
  const hashBytes = normalizeHashBytes(hash);

  return brandLedgerKey<ContractCodeLedgerEntry, xdr.LedgerKeyContractCodeArm>(
    xdr.LedgerKey.contractCode(
      new xdr.LedgerKeyContractCode({
        hash: hashBytes,
      }),
    ),
  );
}

/**
 * Builds a config-setting ledger key branded with the decoded entry type.
 */
export function buildConfigSettingLedgerKey({
  configSettingId,
}: BuildConfigSettingLedgerKeyArgs): ConfigSettingLedgerKey {
  return brandLedgerKey<
    ConfigSettingLedgerEntry,
    xdr.LedgerKeyConfigSettingArm
  >(
    xdr.LedgerKey.configSetting(
      new xdr.LedgerKeyConfigSetting({
        configSettingId: normalizeConfigSettingId(configSettingId),
      }),
    ),
  );
}

/**
 * Builds a TTL ledger key branded with the decoded entry type.
 */
export function buildTtlLedgerKey(args: BuildTtlLedgerKeyArgs): TtlLedgerKey {
  return brandLedgerKey<TtlLedgerEntry, xdr.LedgerKeyTtlArm>(
    xdr.LedgerKey.ttl(
      new xdr.LedgerKeyTtl({
        keyHash: normalizeLedgerKeyHash(args),
      }),
    ),
  );
}
