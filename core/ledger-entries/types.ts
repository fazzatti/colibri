import type {
  BinaryData,
  LedgerKeyLike,
  ScValLike,
  TrustlineAssetLike,
  XdrSerializable,
} from "@/common/types/index.ts";
import type { ScValParsed } from "@/common/helpers/xdr/types.ts";
import type { ChangeTrustAssetString } from "@/common/helpers/xdr/parse-change-trust-asset.ts";
import type { StellarAssetCanonicalString } from "@/asset/sep11/types.ts";
import type { NetworkConfig } from "@/network/index.ts";
import type {
  ClaimableBalanceId,
  ContractId,
  Ed25519PublicKey,
  LiquidityPoolId,
  PreAuthTx,
  Sha256Hash,
  SignedPayload,
} from "@/strkeys/types.ts";

/**
 * Constructor arguments accepted by {@link LedgerEntries}.
 */
export type LedgerEntriesConstructorArgs =
  | {
    networkConfig: NetworkConfig;
    rpc?: never;
  }
  | {
    rpc: RpcLedgerEntriesClient;
    networkConfig?: never;
  };

/**
 * Friendly durability names accepted by contract-data helpers.
 */
export type ContractDataDurabilityName = "persistent" | "temporary";

/**
 * Public config-setting identifiers accepted by config-setting helpers.
 */
export type ConfigSettingIdName =
  | "configSettingContractMaxSizeBytes"
  | "configSettingContractComputeV0"
  | "configSettingContractLedgerCostV0"
  | "configSettingContractHistoricalDataV0"
  | "configSettingContractEventsV0"
  | "configSettingContractBandwidthV0"
  | "configSettingContractCostParamsCpuInstructions"
  | "configSettingContractCostParamsMemoryBytes"
  | "configSettingContractDataKeySizeBytes"
  | "configSettingContractDataEntrySizeBytes"
  | "configSettingStateArchival"
  | "configSettingContractExecutionLanes"
  | "configSettingLiveSorobanStateSizeWindow"
  | "configSettingEvictionIterator"
  | "configSettingContractParallelComputeV0"
  | "configSettingContractLedgerCostExtV0"
  | "configSettingScpTiming";

/**
 * Arguments for building an account ledger key.
 */
export type BuildAccountLedgerKeyArgs = {
  accountId: Ed25519PublicKey;
};

/**
 * Arguments for building a trustline ledger key.
 */
export type BuildTrustlineLedgerKeyArgs = {
  accountId: Ed25519PublicKey;
  asset: TrustlineAssetLike;
};

/**
 * Arguments for building an offer ledger key.
 */
export type BuildOfferLedgerKeyArgs = {
  sellerId: Ed25519PublicKey;
  offerId: bigint | number | string;
};

/**
 * Arguments for building a manage-data ledger key.
 */
export type BuildDataLedgerKeyArgs = {
  accountId: Ed25519PublicKey;
  dataName: string | BinaryData;
};

/**
 * Arguments for building a claimable-balance ledger key.
 */
export type BuildClaimableBalanceLedgerKeyArgs = {
  balanceId: ClaimableBalanceId;
};

/**
 * Arguments for building a liquidity-pool ledger key.
 */
export type BuildLiquidityPoolLedgerKeyArgs = {
  liquidityPoolId: LiquidityPoolId;
};

/**
 * Arguments for building a generic contract-data ledger key.
 */
export type BuildContractDataLedgerKeyArgs = {
  contractId: ContractId;
  key: ScValLike;
  durability?: ContractDataDurabilityName;
};

/**
 * Arguments for building a contract-instance ledger key.
 */
export type BuildContractInstanceLedgerKeyArgs = {
  contractId: ContractId;
};

/**
 * Arguments for building a contract-code ledger key.
 */
export type BuildContractCodeLedgerKeyArgs = {
  hash: string | BinaryData;
};

/**
 * Arguments for building a config-setting ledger key.
 */
export type BuildConfigSettingLedgerKeyArgs = {
  configSettingId: ConfigSettingIdName;
};

/**
 * Arguments for building a TTL ledger key.
 */
export type BuildTtlLedgerKeyArgs =
  | {
    key: LedgerKeyLike;
    keyHash?: never;
  }
  | {
    key?: never;
    keyHash: Sha256Hash | BinaryData;
  };

/**
 * Arguments accepted by {@link LedgerEntries.contractCode}.
 */
export type ContractCodeLookupArgs =
  | BuildContractCodeLedgerKeyArgs
  | {
    contractId: ContractId;
  };

/**
 * Minimal XDR union surface preserved on decoded ledger entries.
 */
export type LedgerEntryValueXdr = XdrSerializable & {
  switch(): { name: string; value: number };
};

/**
 * The parsed RPC entry preserved on all decoded results.
 */
export type LedgerEntryXdr = {
  key: LedgerKeyLike;
  val: LedgerEntryValueXdr;
  lastModifiedLedgerSeq?: number;
  liveUntilLedgerSeq?: number;
};

/**
 * Minimal getLedgerEntries response returned by supported RPC clients.
 */
export type RpcLedgerEntriesResponse = {
  entries: LedgerEntryXdr[];
  latestLedger: number;
};

/**
 * Minimal RPC client contract required by {@link LedgerEntries}.
 */
export interface RpcLedgerEntriesClient {
  /**
   * Fetches one or more live ledger entries by key.
   */
  getLedgerEntries(...keys: LedgerKeyLike[]): Promise<RpcLedgerEntriesResponse>;
}

/**
 * Logical entry types returned by the ledger-entries module.
 */
export type LedgerEntryKind =
  | "account"
  | "trustline"
  | "offer"
  | "data"
  | "claimableBalance"
  | "liquidityPool"
  | "contractData"
  | "contractInstance"
  | "contractCode"
  | "configSetting"
  | "ttl";

/**
 * Friendly account flag view.
 */
export type AccountFlagsView = {
  value: number;
  authRequired: boolean;
  authRevocable: boolean;
  authImmutable: boolean;
  authClawbackEnabled: boolean;
};

/**
 * Friendly trustline flag view.
 */
export type TrustlineFlagsView = {
  value: number;
  authorized: boolean;
  authorizedToMaintainLiabilities: boolean;
  clawbackEnabled: boolean;
};

/**
 * Friendly offer flag view.
 */
export type OfferFlagsView = {
  value: number;
  passive: boolean;
};

/**
 * Friendly claimable-balance flag view.
 */
export type ClaimableBalanceFlagsView = {
  value: number;
  clawbackEnabled: boolean;
};

/**
 * Friendly liability view reused by trustlines and offers.
 */
export type LiabilitiesView = {
  buying: bigint;
  selling: bigint;
};

/**
 * Friendly signer-key view.
 */
export type SignerKeyView =
  | {
    type: "ed25519";
    value: Ed25519PublicKey;
  }
  | {
    type: "preAuthTx";
    value: PreAuthTx;
  }
  | {
    type: "hashX";
    value: Sha256Hash;
  }
  | {
    type: "ed25519SignedPayload";
    value: SignedPayload;
    ed25519PublicKey: Ed25519PublicKey;
    payload: Uint8Array;
  };

/**
 * Friendly signer view returned on account entries.
 */
export type LedgerEntrySigner = {
  key: SignerKeyView;
  weight: number;
};

/**
 * Friendly threshold view returned on account entries.
 */
export type AccountThresholds = {
  masterWeight: number;
  low: number;
  medium: number;
  high: number;
};

/**
 * Friendly offer price view.
 */
export type OfferPrice = {
  n: number;
  d: number;
};

/**
 * Friendly claim-predicate view.
 */
export type ClaimPredicateView =
  | {
    type: "unconditional";
  }
  | {
    type: "and";
    predicates: ClaimPredicateView[];
  }
  | {
    type: "or";
    predicates: ClaimPredicateView[];
  }
  | {
    type: "not";
    predicate: ClaimPredicateView | null;
  }
  | {
    type: "beforeAbsoluteTime";
    unixSeconds: bigint;
  }
  | {
    type: "beforeRelativeTime";
    seconds: bigint;
  };

/**
 * Friendly claimable-balance claimant view.
 */
export type ClaimantView = {
  destination: Ed25519PublicKey;
  predicate: ClaimPredicateView;
};

/**
 * Friendly contract executable view.
 */
export type ContractExecutableView =
  | {
    type: "wasm";
    wasmHash: string;
  }
  | {
    type: "stellarAsset";
  };

/**
 * Value exposed by config-setting reads.
 */
export type ConfigSettingValue =
  | number
  | bigint[]
  | unknown;

/**
 * Shared metadata preserved on all decoded ledger-entry results.
 */
export type BaseLedgerEntry = {
  type: LedgerEntryKind;
  xdr: LedgerEntryXdr;
  lastModifiedLedgerSeq?: number;
  liveUntilLedgerSeq?: number;
};

/**
 * Shared metadata preserved on a specific decoded ledger-entry result.
 */
export type BaseLedgerEntryOf<TKind extends LedgerEntryKind> =
  Omit<BaseLedgerEntry, "type"> & {
    type: TKind;
  };

/**
 * Friendly account-entry result.
 */
export type AccountLedgerEntry = BaseLedgerEntry & {
  type: "account";
  accountId: Ed25519PublicKey;
  balance: bigint;
  sequenceNumber: bigint;
  numSubEntries: number;
  inflationDestination?: Ed25519PublicKey;
  flags: AccountFlagsView;
  homeDomain: string;
  thresholds: AccountThresholds;
  signers: LedgerEntrySigner[];
};

/**
 * Friendly trustline-entry result.
 */
export type TrustlineLedgerEntry = BaseLedgerEntry & {
  type: "trustline";
  accountId: Ed25519PublicKey;
  asset: ChangeTrustAssetString;
  balance: bigint;
  limit: bigint;
  flags: TrustlineFlagsView;
  liabilities?: LiabilitiesView;
};

/**
 * Friendly offer-entry result.
 */
export type OfferLedgerEntry = BaseLedgerEntry & {
  type: "offer";
  sellerId: Ed25519PublicKey;
  offerId: bigint;
  selling: StellarAssetCanonicalString;
  buying: StellarAssetCanonicalString;
  amount: bigint;
  price: OfferPrice;
  flags: OfferFlagsView;
};

/**
 * Friendly manage-data-entry result.
 */
export type DataLedgerEntry = BaseLedgerEntry & {
  type: "data";
  accountId: Ed25519PublicKey;
  dataName: string;
  dataValue: Uint8Array;
};

/**
 * Friendly claimable-balance-entry result.
 */
export type ClaimableBalanceLedgerEntry = BaseLedgerEntry & {
  type: "claimableBalance";
  balanceId: ClaimableBalanceId;
  claimants: ClaimantView[];
  asset: StellarAssetCanonicalString;
  amount: bigint;
  flags: ClaimableBalanceFlagsView;
};

/**
 * Friendly liquidity-pool-entry result.
 */
export type LiquidityPoolLedgerEntry = BaseLedgerEntry & {
  type: "liquidityPool";
  liquidityPoolId: LiquidityPoolId;
  poolType: "liquidityPoolConstantProduct";
  assetA: StellarAssetCanonicalString;
  assetB: StellarAssetCanonicalString;
  fee: number;
  reserveA: bigint;
  reserveB: bigint;
  totalPoolShares: bigint;
  poolSharesTrustLineCount: bigint;
};

/**
 * Friendly generic contract-data-entry result.
 */
export type ContractDataLedgerEntry = BaseLedgerEntry & {
  type: "contractData";
  contractId: ContractId;
  durability: ContractDataDurabilityName;
  keyScVal: ScValLike;
  valueScVal: ScValLike;
  key: ScValParsed;
  value: ScValParsed;
};

/**
 * Friendly contract-instance-entry result.
 */
export type ContractInstanceLedgerEntry = BaseLedgerEntry & {
  type: "contractInstance";
  contractId: ContractId;
  durability: ContractDataDurabilityName;
  keyScVal: ScValLike;
  valueScVal: ScValLike;
  executable: ContractExecutableView;
  storage: ScValParsed;
};

/**
 * Friendly contract-code cost input view.
 */
export type ContractCodeCostInputsView = {
  nInstructions: number;
  nFunctions: number;
  nGlobals: number;
  nTableEntries: number;
  nTypes: number;
  nDataSegments: number;
  nElemSegments: number;
  nImports: number;
  nExports: number;
  nDataSegmentBytes: number;
};

/**
 * Friendly contract-code-entry result.
 */
export type ContractCodeLedgerEntry = BaseLedgerEntry & {
  type: "contractCode";
  hash: string;
  code: Uint8Array;
  costInputs?: ContractCodeCostInputsView;
};

/**
 * Friendly config-setting-entry result.
 */
export type ConfigSettingLedgerEntry = BaseLedgerEntry & {
  type: "configSetting";
  configSettingId: ConfigSettingIdName;
  value: ConfigSettingValue;
};

/**
 * Friendly TTL-entry result.
 */
export type TtlLedgerEntry = BaseLedgerEntry & {
  type: "ttl";
  keyHash: Sha256Hash;
  expiresAtLedger: number;
};

/**
 * Any decoded ledger-entry result returned by this module.
 */
export type AnyLedgerEntry =
  | AccountLedgerEntry
  | TrustlineLedgerEntry
  | OfferLedgerEntry
  | DataLedgerEntry
  | ClaimableBalanceLedgerEntry
  | LiquidityPoolLedgerEntry
  | ContractDataLedgerEntry
  | ContractInstanceLedgerEntry
  | ContractCodeLedgerEntry
  | ConfigSettingLedgerEntry
  | TtlLedgerEntry;

/**
 * Compile-time brand used to associate builder-produced keys with entry types.
 */
export declare const LEDGER_KEY_BRAND: unique symbol;

/**
 * Compile-time branded ledger key that preserves the decoded entry type.
 *
 * At runtime this is still a plain Stellar SDK ledger-key object.
 */
export type TypedLedgerKey<TEntry extends AnyLedgerEntry> = LedgerKeyLike & {
  readonly [LEDGER_KEY_BRAND]?: TEntry;
};

/** Typed account ledger key. */
export type AccountLedgerKey = TypedLedgerKey<AccountLedgerEntry>;
/** Typed trustline ledger key. */
export type TrustlineLedgerKey = TypedLedgerKey<TrustlineLedgerEntry>;
/** Typed offer ledger key. */
export type OfferLedgerKey = TypedLedgerKey<OfferLedgerEntry>;
/** Typed data ledger key. */
export type DataLedgerKey = TypedLedgerKey<DataLedgerEntry>;
/** Typed claimable-balance ledger key. */
export type ClaimableBalanceLedgerKey =
  TypedLedgerKey<ClaimableBalanceLedgerEntry>;
/** Typed liquidity-pool ledger key. */
export type LiquidityPoolLedgerKey = TypedLedgerKey<LiquidityPoolLedgerEntry>;
/** Typed contract-data ledger key. */
export type ContractDataLedgerKey = TypedLedgerKey<ContractDataLedgerEntry>;
/** Typed contract-instance ledger key. */
export type ContractInstanceLedgerKey =
  TypedLedgerKey<ContractInstanceLedgerEntry>;
/** Typed contract-code ledger key. */
export type ContractCodeLedgerKey = TypedLedgerKey<ContractCodeLedgerEntry>;
/** Typed config-setting ledger key. */
export type ConfigSettingLedgerKey = TypedLedgerKey<ConfigSettingLedgerEntry>;
/** Typed TTL ledger key. */
export type TtlLedgerKey = TypedLedgerKey<TtlLedgerEntry>;

/**
 * Any branded ledger key emitted by the public builder helpers.
 */
export type AnyTypedLedgerKey =
  | AccountLedgerKey
  | TrustlineLedgerKey
  | OfferLedgerKey
  | DataLedgerKey
  | ClaimableBalanceLedgerKey
  | LiquidityPoolLedgerKey
  | ContractDataLedgerKey
  | ContractInstanceLedgerKey
  | ContractCodeLedgerKey
  | ConfigSettingLedgerKey
  | TtlLedgerKey;

/**
 * Infers the decoded entry type for a ledger key produced by a builder helper.
 */
export type EntryFromLedgerKey<TKey extends LedgerKeyLike> =
  TKey extends TypedLedgerKey<infer TEntry> ? TEntry : AnyLedgerEntry;
