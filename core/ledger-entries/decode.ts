import { Address, xdr } from "stellar-sdk";
import { Buffer } from "buffer";
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
  ClaimPredicateView,
  ClaimantView,
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

function cleanString(value: string | Buffer): string {
  return (typeof value === "string" ? value : value.toString("utf8"))
    .replace(/\0/g, "");
}

function decodeAccountFlags(flags: number): AccountFlagsView {
  return {
    value: flags,
    authRequired: (flags & xdr.AccountFlags.authRequiredFlag().value) !== 0,
    authRevocable: (flags & xdr.AccountFlags.authRevocableFlag().value) !== 0,
    authImmutable: (flags & xdr.AccountFlags.authImmutableFlag().value) !== 0,
    authClawbackEnabled:
      (flags & xdr.AccountFlags.authClawbackEnabledFlag().value) !== 0,
  };
}

function decodeTrustlineFlags(flags: number): TrustlineFlagsView {
  return {
    value: flags,
    authorized: (flags & xdr.TrustLineFlags.authorizedFlag().value) !== 0,
    authorizedToMaintainLiabilities:
      (flags &
        xdr.TrustLineFlags.authorizedToMaintainLiabilitiesFlag().value) !== 0,
    clawbackEnabled:
      (flags & xdr.TrustLineFlags.trustlineClawbackEnabledFlag().value) !== 0,
  };
}

function decodeOfferFlags(flags: number): OfferFlagsView {
  return {
    value: flags,
    passive: (flags & xdr.OfferEntryFlags.passiveFlag().value) !== 0,
  };
}

function decodeClaimableBalanceFlags(flags: number): ClaimableBalanceFlagsView {
  return {
    value: flags,
    clawbackEnabled:
      (flags & xdr.ClaimableBalanceFlags.claimableBalanceClawbackEnabledFlag()
        .value) !== 0,
  };
}

function decodeLiabilities(liabilities: xdr.Liabilities): LiabilitiesView {
  return {
    buying: liabilities.buying().toBigInt(),
    selling: liabilities.selling().toBigInt(),
  };
}

function decodeThresholds(thresholds: Buffer): AccountThresholds {
  return {
    masterWeight: thresholds[0] ?? 0,
    low: thresholds[1] ?? 0,
    medium: thresholds[2] ?? 0,
    high: thresholds[3] ?? 0,
  };
}

function decodeSignerKey(key: xdr.SignerKey): SignerKeyView {
  const type = key.switch().name;

  switch (type) {
    case "signerKeyTypeEd25519":
      return {
        type: "ed25519",
        value: StrKey.encodeEd25519PublicKey(key.ed25519()),
      };

    case "signerKeyTypePreAuthTx":
      return {
        type: "preAuthTx",
        value: StrKey.encodePreAuthTx(key.preAuthTx()),
      };

    case "signerKeyTypeHashX":
      return {
        type: "hashX",
        value: StrKey.encodeSha256Hash(key.hashX()),
      };

    case "signerKeyTypeEd25519SignedPayload": {
      const signedPayload = key.ed25519SignedPayload();
      return {
        type: "ed25519SignedPayload",
        value: StrKey.encodeSignedPayload(signedPayload.toXDR()),
        ed25519PublicKey: StrKey.encodeEd25519PublicKey(signedPayload.ed25519()),
        payload: Uint8Array.from(signedPayload.payload()),
      };
    }

    default:
      throw new Error(`Unsupported signer key type: ${type}`);
  }
}

function decodeSigner(signer: xdr.Signer): LedgerEntrySigner {
  return {
    key: decodeSignerKey(signer.key()),
    weight: signer.weight(),
  };
}

function decodeClaimPredicate(
  predicate: xdr.ClaimPredicate,
): ClaimPredicateView {
  switch (predicate.switch().name) {
    case "claimPredicateUnconditional":
      return { type: "unconditional" };
    case "claimPredicateAnd":
      return {
        type: "and",
        predicates: predicate.andPredicates().map(decodeClaimPredicate),
      };
    case "claimPredicateOr":
      return {
        type: "or",
        predicates: predicate.orPredicates().map(decodeClaimPredicate),
      };
    case "claimPredicateNot":
      return {
        type: "not",
        predicate: predicate.notPredicate()
          ? decodeClaimPredicate(predicate.notPredicate()!)
          : null,
      };
    case "claimPredicateBeforeAbsoluteTime":
      return {
        type: "beforeAbsoluteTime",
        unixSeconds: predicate.absBefore().toBigInt(),
      };
    case "claimPredicateBeforeRelativeTime":
      return {
        type: "beforeRelativeTime",
        seconds: predicate.relBefore().toBigInt(),
      };
    default:
      throw new Error(`Unsupported claim predicate type: ${predicate.switch().name}`);
  }
}

function decodeClaimant(claimant: xdr.Claimant): ClaimantView {
  const v0 = claimant.v0();
  return {
    destination: parseAccountId(v0.destination()),
    predicate: decodeClaimPredicate(v0.predicate()),
  };
}

function decodeContractExecutable(
  executable: xdr.ContractExecutable,
): ContractExecutableView {
  switch (executable.switch().name) {
    case "contractExecutableWasm":
      return {
        type: "wasm",
        wasmHash: executable.wasmHash().toString("hex"),
      };
    case "contractExecutableStellarAsset":
      return {
        type: "stellarAsset",
      };
    default:
      throw new Error(
        `Unsupported contract executable type: ${executable.switch().name}`,
      );
  }
}

function normalizeConfigSettingValue(value: ConfigSettingValue): ConfigSettingValue {
  if (Array.isArray(value) && value.every((item) =>
    typeof item === "object" && item !== null && "toBigInt" in item
  )) {
    return value.map((item) => item.toBigInt()) as bigint[];
  }

  return value;
}

function decodeContractCodeCostInputs(
  costInputs: xdr.ContractCodeCostInputs,
): ContractCodeCostInputsView {
  return {
    nInstructions: costInputs.nInstructions(),
    nFunctions: costInputs.nFunctions(),
    nGlobals: costInputs.nGlobals(),
    nTableEntries: costInputs.nTableEntries(),
    nTypes: costInputs.nTypes(),
    nDataSegments: costInputs.nDataSegments(),
    nElemSegments: costInputs.nElemSegments(),
    nImports: costInputs.nImports(),
    nExports: costInputs.nExports(),
    nDataSegmentBytes: costInputs.nDataSegmentBytes(),
  };
}

function decodeAccountEntry(entry: Api.LedgerEntryResult): AccountLedgerEntry {
  const account = entry.val.account();

  return {
    ...decodeBaseEntry("account", entry),
    accountId: parseAccountId(account.accountId()),
    balance: account.balance().toBigInt(),
    sequenceNumber: account.seqNum().toBigInt(),
    numSubEntries: account.numSubEntries(),
    inflationDestination: account.inflationDest()
      ? parseAccountId(account.inflationDest()!)
      : undefined,
    flags: decodeAccountFlags(account.flags()),
    homeDomain: cleanString(account.homeDomain()),
    thresholds: decodeThresholds(Buffer.from(account.thresholds())),
    signers: account.signers().map(decodeSigner),
  };
}

function decodeTrustlineEntry(
  entry: Api.LedgerEntryResult,
): TrustlineLedgerEntry {
  const trustline = entry.val.trustLine();

  return {
    ...decodeBaseEntry("trustline", entry),
    accountId: parseAccountId(trustline.accountId()),
    asset: parseTrustLineAsset(trustline.asset()),
    balance: trustline.balance().toBigInt(),
    limit: trustline.limit().toBigInt(),
    flags: decodeTrustlineFlags(trustline.flags()),
    liabilities: trustline.ext().switch() === 1
      ? decodeLiabilities(trustline.ext().v1().liabilities())
      : undefined,
  };
}

function decodeOfferEntry(entry: Api.LedgerEntryResult): OfferLedgerEntry {
  const offer = entry.val.offer();
  const price: OfferPrice = {
    n: offer.price().n(),
    d: offer.price().d(),
  };

  return {
    ...decodeBaseEntry("offer", entry),
    sellerId: parseAccountId(offer.sellerId()),
    offerId: offer.offerId().toBigInt(),
    selling: parseAsset(offer.selling()),
    buying: parseAsset(offer.buying()),
    amount: offer.amount().toBigInt(),
    price,
    flags: decodeOfferFlags(offer.flags()),
  };
}

function decodeDataEntry(entry: Api.LedgerEntryResult): DataLedgerEntry {
  const data = entry.val.data();

  return {
    ...decodeBaseEntry("data", entry),
    accountId: parseAccountId(data.accountId()),
    dataName: cleanString(data.dataName()),
    dataValue: Uint8Array.from(data.dataValue()),
  };
}

function decodeClaimableBalanceEntry(
  entry: Api.LedgerEntryResult,
): ClaimableBalanceLedgerEntry {
  const claimableBalance = entry.val.claimableBalance();
  const flags = claimableBalance.ext().switch() === 1
    ? claimableBalance.ext().v1().flags()
    : 0;

  return {
    ...decodeBaseEntry("claimableBalance", entry),
    balanceId: StrKey.encodeClaimableBalance(
      Buffer.concat([
        Buffer.from([0]),
        Buffer.from(claimableBalance.balanceId().v0()),
      ]),
    ),
    claimants: claimableBalance.claimants().map(decodeClaimant),
    asset: parseAsset(claimableBalance.asset()),
    amount: claimableBalance.amount().toBigInt(),
    flags: decodeClaimableBalanceFlags(flags),
  };
}

function decodeLiquidityPoolEntry(
  entry: Api.LedgerEntryResult,
): LiquidityPoolLedgerEntry {
  const liquidityPool = entry.val.liquidityPool();
  const constantProduct = liquidityPool.body().constantProduct();
  const params = constantProduct.params();

  return {
    ...decodeBaseEntry("liquidityPool", entry),
    liquidityPoolId: StrKey.encodeLiquidityPool(
      Buffer.from(liquidityPool.liquidityPoolId() as unknown as Uint8Array),
    ),
    poolType: "liquidityPoolConstantProduct",
    assetA: parseAsset(params.assetA()),
    assetB: parseAsset(params.assetB()),
    fee: params.fee(),
    reserveA: constantProduct.reserveA().toBigInt(),
    reserveB: constantProduct.reserveB().toBigInt(),
    totalPoolShares: constantProduct.totalPoolShares().toBigInt(),
    poolSharesTrustLineCount: constantProduct.poolSharesTrustLineCount()
      .toBigInt(),
  };
}

function decodeContractDataEntry(
  entry: Api.LedgerEntryResult,
): ContractDataLedgerEntry {
  const contractData = entry.val.contractData();

  return {
    ...decodeBaseEntry("contractData", entry),
    contractId: Address.fromScAddress(contractData.contract()).toString() as ContractId,
    durability: contractData.durability().name as ContractDataDurabilityName,
    keyScVal: contractData.key(),
    valueScVal: contractData.val(),
    key: parseScVal(contractData.key()),
    value: parseScVal(contractData.val()),
  };
}

function decodeContractInstanceEntry(
  entry: Api.LedgerEntryResult,
): ContractInstanceLedgerEntry {
  const contractData = entry.val.contractData();
  const instance = contractData.val().instance();
  const storage = xdr.ScVal.scvMap(instance.storage() ?? []);

  return {
    ...decodeBaseEntry("contractInstance", entry),
    contractId: Address.fromScAddress(contractData.contract()).toString() as ContractId,
    durability: contractData.durability().name as ContractDataDurabilityName,
    keyScVal: contractData.key(),
    valueScVal: contractData.val(),
    executable: decodeContractExecutable(instance.executable()),
    storage: parseScVal(storage),
  };
}

function decodeContractCodeEntry(
  entry: Api.LedgerEntryResult,
): ContractCodeLedgerEntry {
  const contractCode = entry.val.contractCode();

  return {
    ...decodeBaseEntry("contractCode", entry),
    hash: contractCode.hash().toString("hex"),
    code: Uint8Array.from(contractCode.code()),
    costInputs: contractCode.ext().switch() === 1
      ? decodeContractCodeCostInputs(contractCode.ext().v1().costInputs())
      : undefined,
  };
}

function decodeConfigSettingEntry(
  entry: Api.LedgerEntryResult,
): ConfigSettingLedgerEntry {
  const configSetting = entry.val.configSetting();

  return {
    ...decodeBaseEntry("configSetting", entry),
    configSettingId: configSetting.switch().name as ConfigSettingIdName,
    value: normalizeConfigSettingValue(configSetting.value()),
  };
}

function decodeTtlEntry(entry: Api.LedgerEntryResult): TtlLedgerEntry {
  const ttl = entry.val.ttl();

  return {
    ...decodeBaseEntry("ttl", entry),
    keyHash: StrKey.encodeSha256Hash(ttl.keyHash()),
    expiresAtLedger: ttl.liveUntilLedgerSeq(),
  };
}

/**
 * Derives the logical entry type represented by a ledger key.
 */
export function detectLedgerEntryKindFromKey(key: xdr.LedgerKey): LedgerEntryKind {
  switch (key.switch().name) {
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
      return key.contractData().key().switch().name ===
          "scvLedgerKeyContractInstance"
        ? "contractInstance"
        : "contractData";
    case "contractCode":
      return "contractCode";
    case "configSetting":
      return "configSetting";
    case "ttl":
      return "ttl";
    default:
      throw new Error(`Unsupported ledger key type: ${key.switch().name}`);
  }
}

/**
 * Decodes a parsed RPC ledger-entry result into the corresponding friendly shape.
 */
export function decodeLedgerEntry(entry: Api.LedgerEntryResult): AnyLedgerEntry {
  switch (entry.val.switch().name) {
    case "account":
      return decodeAccountEntry(entry);
    case "trustline":
      return decodeTrustlineEntry(entry);
    case "offer":
      return decodeOfferEntry(entry);
    case "data":
      return decodeDataEntry(entry);
    case "claimableBalance":
      return decodeClaimableBalanceEntry(entry);
    case "liquidityPool":
      return decodeLiquidityPoolEntry(entry);
    case "contractData":
      return entry.val.contractData().key().switch().name ===
          "scvLedgerKeyContractInstance"
        ? decodeContractInstanceEntry(entry)
        : decodeContractDataEntry(entry);
    case "contractCode":
      return decodeContractCodeEntry(entry);
    case "configSetting":
      return decodeConfigSettingEntry(entry);
    case "ttl":
      return decodeTtlEntry(entry);
    default:
      throw new Error(`Unsupported ledger entry type: ${entry.val.switch().name}`);
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
