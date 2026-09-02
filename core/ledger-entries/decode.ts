import { Address, xdr } from "stellar-sdk";
import { StrKey } from "@/strkeys/index.ts";
import { parseAccountId } from "@/common/helpers/xdr/parse-account-id.ts";
import { parseAsset } from "@/common/helpers/xdr/parse-asset.ts";
import { parseTrustLineAsset } from "@/common/helpers/xdr/parse-trustline-asset.ts";
import { parseScVal } from "@/common/helpers/xdr/scval.ts";
import * as E from "@/ledger-entries/error.ts";
import type { ContractId } from "@/strkeys/types.ts";
import type { Api } from "stellar-sdk/rpc";
import type {
  AccountFlagsView,
  AccountLedgerEntry,
  AccountThresholds,
  AnyLedgerEntry,
  BaseLedgerEntryOf,
  ClaimableBalanceFlagsView,
  ClaimableBalanceLedgerEntry,
  ClaimantView,
  ClaimPredicateView,
  ConfigSettingIdName,
  ConfigSettingLedgerEntry,
  ConfigSettingValue,
  ContractCodeCostInputsView,
  ContractCodeLedgerEntry,
  ContractDataDurabilityName,
  ContractDataLedgerEntry,
  ContractExecutableView,
  ContractInstanceLedgerEntry,
  DataLedgerEntry,
  LedgerEntryKind,
  LedgerEntrySigner,
  LiabilitiesView,
  LiquidityPoolLedgerEntry,
  OfferFlagsView,
  OfferLedgerEntry,
  OfferPrice,
  SignerKeyView,
  TrustlineFlagsView,
  TrustlineLedgerEntry,
  TtlLedgerEntry,
} from "@/ledger-entries/types.ts";

function decodeBaseEntry<TKind extends LedgerEntryKind>(
  type: TKind,
  entry: Api.LedgerEntryResult,
): BaseLedgerEntryOf<TKind> {
  return {
    type,
    xdr: entry,
    lastModifiedLedgerSeq: entry.lastModifiedLedgerSeq,
    liveUntilLedgerSeq: entry.liveUntilLedgerSeq,
  };
}

function cleanString(value: string | { toString(): string }): string {
  return value.toString().replace(/\0/g, "");
}

function decodeAccountFlags(flags: number): AccountFlagsView {
  return {
    value: flags,
    authRequired: (flags & xdr.AccountFlags.authRequiredFlag.value) !== 0,
    authRevocable: (flags & xdr.AccountFlags.authRevocableFlag.value) !== 0,
    authImmutable: (flags & xdr.AccountFlags.authImmutableFlag.value) !== 0,
    authClawbackEnabled:
      (flags & xdr.AccountFlags.authClawbackEnabledFlag.value) !== 0,
  };
}

function decodeTrustlineFlags(flags: number): TrustlineFlagsView {
  return {
    value: flags,
    authorized: (flags & xdr.TrustLineFlags.authorizedFlag.value) !== 0,
    authorizedToMaintainLiabilities: (flags &
      xdr.TrustLineFlags.authorizedToMaintainLiabilitiesFlag.value) !== 0,
    clawbackEnabled:
      (flags & xdr.TrustLineFlags.trustlineClawbackEnabledFlag.value) !== 0,
  };
}

function decodeOfferFlags(flags: number): OfferFlagsView {
  return {
    value: flags,
    passive: (flags & xdr.OfferEntryFlags.passiveFlag.value) !== 0,
  };
}

function decodeClaimableBalanceFlags(flags: number): ClaimableBalanceFlagsView {
  return {
    value: flags,
    clawbackEnabled:
      (flags & xdr.ClaimableBalanceFlags.claimableBalanceClawbackEnabledFlag
        .value) !== 0,
  };
}

function decodeLiabilities(liabilities: xdr.Liabilities): LiabilitiesView {
  return {
    buying: liabilities.buying,
    selling: liabilities.selling,
  };
}

function decodeThresholds(thresholds: Uint8Array): AccountThresholds {
  return {
    masterWeight: thresholds[0],
    low: thresholds[1],
    medium: thresholds[2],
    high: thresholds[3],
  };
}

function decodeSignerKey(key: xdr.SignerKey): SignerKeyView {
  const type = key.type;

  switch (type) {
    case "signerKeyTypeEd25519":
      return {
        type: "ed25519",
        value: StrKey.encodeEd25519PublicKey(key.ed25519.toBytes()),
      };

    case "signerKeyTypePreAuthTx":
      return {
        type: "preAuthTx",
        value: StrKey.encodePreAuthTx(key.preAuthTx.toBytes()),
      };

    case "signerKeyTypeHashX":
      return {
        type: "hashX",
        value: StrKey.encodeSha256Hash(key.hashX.toBytes()),
      };

    case "signerKeyTypeEd25519SignedPayload": {
      const signedPayload = key.ed25519SignedPayload;
      return {
        type: "ed25519SignedPayload",
        value: StrKey.encodeSignedPayload(signedPayload.toXdr()),
        ed25519PublicKey: StrKey.encodeEd25519PublicKey(
          signedPayload.ed25519.toBytes(),
        ),
        payload: Uint8Array.from(signedPayload.payload),
      };
    }

    default:
      throw new E.UNSUPPORTED_XDR_VARIANT("signer key", type);
  }
}

function decodeSigner(signer: xdr.Signer): LedgerEntrySigner {
  return {
    key: decodeSignerKey(signer.key),
    weight: signer.weight,
  };
}

function decodeClaimPredicate(
  predicate: xdr.ClaimPredicate,
): ClaimPredicateView {
  switch (predicate.type) {
    case "claimPredicateUnconditional":
      return { type: "unconditional" };
    case "claimPredicateAnd":
      return {
        type: "and",
        predicates: predicate.andPredicates.map(decodeClaimPredicate),
      };
    case "claimPredicateOr":
      return {
        type: "or",
        predicates: predicate.orPredicates.map(decodeClaimPredicate),
      };
    case "claimPredicateNot":
      return {
        type: "not",
        predicate: predicate.notPredicate
          ? decodeClaimPredicate(predicate.notPredicate)
          : null,
      };
    case "claimPredicateBeforeAbsoluteTime":
      return {
        type: "beforeAbsoluteTime",
        unixSeconds: predicate.absBefore,
      };
    case "claimPredicateBeforeRelativeTime":
      return {
        type: "beforeRelativeTime",
        seconds: predicate.relBefore,
      };
    default:
      throw new E.UNSUPPORTED_XDR_VARIANT(
        "claim predicate",
        (predicate as { type: string }).type,
      );
  }
}

function decodeClaimant(claimant: xdr.Claimant): ClaimantView {
  const v0 = claimant.v0;
  return {
    destination: parseAccountId(v0.destination),
    predicate: decodeClaimPredicate(v0.predicate),
  };
}

function decodeContractExecutable(
  executable: xdr.ContractExecutable,
): ContractExecutableView {
  switch (executable.type) {
    case "contractExecutableWasm":
      return {
        type: "wasm",
        wasmHash: executable.wasmHash.toString(),
      };
    case "contractExecutableStellarAsset":
      return {
        type: "stellarAsset",
      };
    case "contractExecutableExternalRef":
      return {
        type: "externalRef",
        executableOwner: Address.fromScAddress(
          executable.externalRef.executableOwner,
        ).toString(),
        tag: Uint8Array.from(executable.externalRef.tag.bytes),
      };
    default:
      throw new E.UNSUPPORTED_XDR_VARIANT(
        "contract executable",
        (executable as { type: string }).type,
      );
  }
}

function decodeContractCodeCostInputs(
  costInputs: xdr.ContractCodeCostInputs,
): ContractCodeCostInputsView {
  return {
    nInstructions: costInputs.nInstructions,
    nFunctions: costInputs.nFunctions,
    nGlobals: costInputs.nGlobals,
    nTableEntries: costInputs.nTableEntries,
    nTypes: costInputs.nTypes,
    nDataSegments: costInputs.nDataSegments,
    nElemSegments: costInputs.nElemSegments,
    nImports: costInputs.nImports,
    nExports: costInputs.nExports,
    nDataSegmentBytes: costInputs.nDataSegmentBytes,
  };
}

function decodeAccountEntry(
  entry: Api.LedgerEntryResult,
  account: xdr.AccountEntry,
): AccountLedgerEntry {
  return {
    ...decodeBaseEntry("account", entry),
    accountId: parseAccountId(account.accountId),
    balance: account.balance,
    sequenceNumber: account.seqNum,
    numSubEntries: account.numSubEntries,
    inflationDestination: account.inflationDest
      ? parseAccountId(account.inflationDest)
      : undefined,
    flags: decodeAccountFlags(account.flags),
    homeDomain: cleanString(account.homeDomain),
    thresholds: decodeThresholds(account.thresholds.toBytes()),
    signers: account.signers.map(decodeSigner),
  };
}

function decodeTrustlineEntry(
  entry: Api.LedgerEntryResult,
  trustline: xdr.TrustLineEntry,
): TrustlineLedgerEntry {
  return {
    ...decodeBaseEntry("trustline", entry),
    accountId: parseAccountId(trustline.accountId),
    asset: parseTrustLineAsset(trustline.asset),
    balance: trustline.balance,
    limit: trustline.limit,
    flags: decodeTrustlineFlags(trustline.flags),
    liabilities: trustline.ext.type === "v1"
      ? decodeLiabilities(trustline.ext.v1.liabilities)
      : undefined,
  };
}

function decodeOfferEntry(
  entry: Api.LedgerEntryResult,
  offer: xdr.OfferEntry,
): OfferLedgerEntry {
  const price: OfferPrice = {
    n: offer.price.n,
    d: offer.price.d,
  };

  return {
    ...decodeBaseEntry("offer", entry),
    sellerId: parseAccountId(offer.sellerId),
    offerId: offer.offerId,
    selling: parseAsset(offer.selling),
    buying: parseAsset(offer.buying),
    amount: offer.amount,
    price,
    flags: decodeOfferFlags(offer.flags),
  };
}

function decodeDataEntry(
  entry: Api.LedgerEntryResult,
  data: xdr.DataEntry,
): DataLedgerEntry {
  return {
    ...decodeBaseEntry("data", entry),
    accountId: parseAccountId(data.accountId),
    dataName: cleanString(data.dataName),
    dataValue: data.dataValue.toBytes(),
  };
}

function decodeClaimableBalanceEntry(
  entry: Api.LedgerEntryResult,
  claimableBalance: xdr.ClaimableBalanceEntry,
): ClaimableBalanceLedgerEntry {
  const flags = claimableBalance.ext.type === "v1"
    ? claimableBalance.ext.v1.flags
    : 0;
  const balanceId = new Uint8Array(33);
  balanceId.set(claimableBalance.balanceId.v0.toBytes(), 1);

  return {
    ...decodeBaseEntry("claimableBalance", entry),
    balanceId: StrKey.encodeClaimableBalance(balanceId),
    claimants: claimableBalance.claimants.map(decodeClaimant),
    asset: parseAsset(claimableBalance.asset),
    amount: claimableBalance.amount,
    flags: decodeClaimableBalanceFlags(flags),
  };
}

function decodeLiquidityPoolEntry(
  entry: Api.LedgerEntryResult,
  liquidityPool: xdr.LiquidityPoolEntry,
): LiquidityPoolLedgerEntry {
  const constantProduct = liquidityPool.body.constantProduct;
  const params = constantProduct.params;

  return {
    ...decodeBaseEntry("liquidityPool", entry),
    liquidityPoolId: StrKey.encodeLiquidityPool(
      liquidityPool.liquidityPoolId.toBytes(),
    ),
    poolType: "liquidityPoolConstantProduct",
    assetA: parseAsset(params.assetA),
    assetB: parseAsset(params.assetB),
    fee: params.fee,
    reserveA: constantProduct.reserveA,
    reserveB: constantProduct.reserveB,
    totalPoolShares: constantProduct.totalPoolShares,
    poolSharesTrustLineCount: constantProduct.poolSharesTrustLineCount,
  };
}

function decodeContractDataEntry(
  entry: Api.LedgerEntryResult,
  contractData: xdr.ContractDataEntry,
): ContractDataLedgerEntry {
  return {
    ...decodeBaseEntry("contractData", entry),
    contractId: Address.fromScAddress(contractData.contract)
      .toString() as ContractId,
    durability: contractData.durability.name as ContractDataDurabilityName,
    keyScVal: contractData.key,
    valueScVal: contractData.val,
    key: parseScVal(contractData.key),
    value: parseScVal(contractData.val),
  };
}

function decodeContractInstanceEntry(
  entry: Api.LedgerEntryResult,
  contractData: xdr.ContractDataEntry,
  instance: xdr.ScContractInstance,
): ContractInstanceLedgerEntry {
  const storage = xdr.ScVal.scvMap(instance.storage ?? []);

  return {
    ...decodeBaseEntry("contractInstance", entry),
    contractId: Address.fromScAddress(contractData.contract)
      .toString() as ContractId,
    durability: contractData.durability.name as ContractDataDurabilityName,
    keyScVal: contractData.key,
    valueScVal: contractData.val,
    executable: decodeContractExecutable(instance.executable),
    storage: parseScVal(storage),
  };
}

function decodeContractCodeEntry(
  entry: Api.LedgerEntryResult,
  contractCode: xdr.ContractCodeEntry,
): ContractCodeLedgerEntry {
  return {
    ...decodeBaseEntry("contractCode", entry),
    hash: contractCode.hash.toString(),
    code: Uint8Array.from(contractCode.code),
    costInputs: contractCode.ext.type === "v1"
      ? decodeContractCodeCostInputs(contractCode.ext.v1.costInputs)
      : undefined,
  };
}

function decodeConfigSettingEntry(
  entry: Api.LedgerEntryResult,
  configSetting: xdr.ConfigSettingEntry,
): ConfigSettingLedgerEntry {
  return {
    ...decodeBaseEntry("configSetting", entry),
    configSettingId: configSetting.type as ConfigSettingIdName,
    value: configSetting.value as ConfigSettingValue,
  };
}

function decodeTtlEntry(
  entry: Api.LedgerEntryResult,
  ttl: xdr.TtlEntry,
): TtlLedgerEntry {
  return {
    ...decodeBaseEntry("ttl", entry),
    keyHash: StrKey.encodeSha256Hash(ttl.keyHash.toBytes()),
    expiresAtLedger: ttl.liveUntilLedgerSeq,
  };
}

/**
 * Derives the logical entry type represented by a ledger key.
 */
export function detectLedgerEntryKindFromKey(
  key: xdr.LedgerKey,
): LedgerEntryKind {
  switch (key.type) {
    case "account":
      return "account";
    case "trustline":
      return "trustline";
    case "offer":
      return "offer";
    case "data":
      return "data";
    case "claimableBalance":
      return "claimableBalance";
    case "liquidityPool":
      return "liquidityPool";
    case "contractData":
      return key.contractData.key.type === "scvLedgerKeyContractInstance"
        ? "contractInstance"
        : "contractData";
    case "contractCode":
      return "contractCode";
    case "configSetting":
      return "configSetting";
    case "ttl":
      return "ttl";
    default:
      throw new E.UNSUPPORTED_XDR_VARIANT(
        "ledger key",
        (key as { type: string }).type,
      );
  }
}

/**
 * Decodes a parsed RPC ledger-entry result into the corresponding friendly shape.
 */
export function decodeLedgerEntry(
  entry: Api.LedgerEntryResult,
): AnyLedgerEntry {
  switch (entry.val.type) {
    case "account":
      return decodeAccountEntry(entry, entry.val.account);
    case "trustline":
      return decodeTrustlineEntry(entry, entry.val.trustLine);
    case "offer":
      return decodeOfferEntry(entry, entry.val.offer);
    case "data":
      return decodeDataEntry(entry, entry.val.data);
    case "claimableBalance":
      return decodeClaimableBalanceEntry(entry, entry.val.claimableBalance);
    case "liquidityPool":
      return decodeLiquidityPoolEntry(entry, entry.val.liquidityPool);
    case "contractData": {
      const contractData = entry.val.contractData;
      return contractData.key.type === "scvLedgerKeyContractInstance" &&
          contractData.val.type === "scvContractInstance"
        ? decodeContractInstanceEntry(
          entry,
          contractData,
          contractData.val.instance,
        )
        : decodeContractDataEntry(entry, contractData);
    }
    case "contractCode":
      return decodeContractCodeEntry(entry, entry.val.contractCode);
    case "configSetting":
      return decodeConfigSettingEntry(entry, entry.val.configSetting);
    case "ttl":
      return decodeTtlEntry(entry, entry.val.ttl);
    default:
      throw new E.UNSUPPORTED_XDR_VARIANT(
        "ledger entry",
        (entry.val as { type: string }).type,
      );
  }
}

/**
 * Decodes and validates that the RPC result matches the requested key type.
 */
export function decodeLedgerEntryForKey(
  key: xdr.LedgerKey,
  entry: Api.LedgerEntryResult,
): AnyLedgerEntry {
  const expected = detectLedgerEntryKindFromKey(key);
  const decoded = decodeLedgerEntry(entry);

  if (decoded.type !== expected) {
    throw new E.UNEXPECTED_LEDGER_ENTRY_TYPE(expected, decoded.type);
  }

  return decoded;
}
