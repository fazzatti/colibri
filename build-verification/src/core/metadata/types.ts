import type { ContractMetadataEntry } from "../recipe/types.ts";

/** One decoded `contractmetav0` custom section. */
export type ContractMetadataSection = {
  readonly index: number;
  readonly entries: readonly ContractMetadataEntry[];
  readonly containsCliVersion: boolean;
};

/** All metadata sections plus the authoritative section selected for SEP-58. */
export type ExtractedContractMetadata = {
  readonly sections: readonly ContractMetadataSection[];
  readonly selectedSection?: number;
  readonly entries: readonly ContractMetadataEntry[];
};
