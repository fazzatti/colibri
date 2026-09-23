import type { SorobanDataBuilder } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type {
  ResourceAdjustment,
  ResourceAmount,
  ResourcePadding,
} from "@/common/types/transaction-config/resources.ts";

/** @internal Exact native SDK resource data builder. */
type NativeResourceDataBuilder = SorobanDataBuilder;
/** @internal Exact native SDK methods; no wrapper or alternate RPC contract. */
type NativeResourceSettingsRpc = Pick<
  Server,
  "getNetwork" | "getLedgerEntries"
>;

/** Network limits and tariffs used by the scalar resource-padding calculator. */
export interface NetworkResourceSettings {
  /** Passphrase reported by getNetwork; use the same network as the simulation. */
  networkPassphrase: string;
  /** Protocol reported by getNetwork, a separate read from the settings batch. */
  protocolVersion: number;
  /** Ledger observed by the single batched getLedgerEntries request. */
  latestLedger: number;
  /** Per-transaction ceilings, expressed in instructions or bytes. */
  limits: {
    /** Maximum declared instructions. */
    instructions: number;
    /** Maximum declared disk-read bytes. */
    diskReadBytes: number;
    /** Maximum declared write bytes. */
    writeBytes: number;
    /** Maximum execution memory in bytes; not a configurable declaration. */
    memoryBytes: number;
    /** Maximum footprint entries; this helper never changes the footprint. */
    footprintEntries: number;
  };
  /** Non-refundable tariffs in decimal stroops per indicated increment. */
  fees: {
    /** Stroops per 10,000 declared instructions. */
    perInstructionIncrement: string;
    /** Stroops per 1,024 disk-read bytes. */
    perDiskRead1KB: string;
    /** Stroops per 1,024 write bytes, from ledger-cost extension settings. */
    perWrite1KB: string;
  };
}

/** RPC methods required by the explicit settings reader. */
export type ResourceSettingsRpc = NativeResourceSettingsRpc;

/** Caller-owned RPC dependency; reading settings is always explicit. */
export interface GetNetworkResourceSettingsInput {
  /** RPC connected to the simulation's network. */
  rpc: ResourceSettingsRpc;
}

/** Requests resource growth plus separately funded refundable headroom. */
export type ResourcePaddingRequest = Omit<ResourcePadding, "resourceFee"> & {
  /**
   * Extra refundable allowance in stroops, after funding resource growth.
   * Percentages use the simulation's TOTAL resource fee as their baseline,
   * since RPC does not return an isolated refundable-fee recommendation.
   * The result folds this allowance into resourceFee exactly once.
   */
  refundableFee?: ResourceAdjustment<string>;
};

/** Inputs to the pure calculator; no network access or transaction mutation. */
export interface CalculateResourcePaddingInput {
  /** Successful FINAL simulation, including enforcing authorization if needed. */
  simulation: {
    /** Recommended Soroban data whose resource counts are the padding baseline. */
    transactionData: NativeResourceDataBuilder;
    /** Ledger at which the simulation was observed. */
    latestLedger: number;
  };
  /** Explicitly obtained settings from the same network. */
  settings: NetworkResourceSettings;
  /** Requested additions. Does not change footprints, auth, rent TTL or transaction size. */
  padding: ResourcePaddingRequest;
}

/** Concrete additions to apply once to the same simulation baseline. */
export interface CalculatedResourcePadding {
  /** Concrete instruction addition. */
  instructions: ResourceAmount<number>;
  /** Concrete disk-read byte addition. */
  diskReadBytes: ResourceAmount<number>;
  /** Concrete write-byte addition. */
  writeBytes: ResourceAmount<number>;
  /** Total additional resource fee, including requested refundable headroom. */
  resourceFee: ResourceAmount<string>;
}

/** Inspectable calculation result; no setting is installed automatically. */
export interface ResourcePaddingCalculation {
  /** Ready-to-apply configuration; do not add the requested refundable fee again. */
  padding: CalculatedResourcePadding;
  /** Additional fees in decimal stroops, preserving the original refundable allowance. */
  breakdown: {
    /** Increased charge for declared instruction/read/write budgets. */
    nonRefundableFee: string;
    /** Explicit additional allowance for refundable charges. */
    refundableFee: string;
    /** Sum of the two additions, also returned in padding.resourceFee.amount. */
    resourceFee: string;
  };
  /** Original resource data; compare before applying after a new simulation. */
  simulationDataXdr: string;
  /** Simulation observation ledger. */
  simulationLedger: number;
  /** Settings observation ledger; not necessarily the simulation ledger. */
  settingsLedger: number;
  /** Settings protocol, retained to make the quote auditable. */
  protocolVersion: number;
  /** Settings network identity. */
  networkPassphrase: string;
}
