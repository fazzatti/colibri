/** Ordered metadata key/value pair replayed during a contract rebuild. */
export type ContractMetadataEntry = {
  readonly key: string;
  readonly value: string;
};

/** Exact build recipe discovered from SEP-58 or supplied out of band. */
export type ContractBuildRecipe = {
  readonly image: string;
  readonly arguments: readonly string[];
  readonly options: readonly string[];
  readonly metadata: readonly ContractMetadataEntry[];
  readonly sourceUri?: string;
  readonly sourceSha256?: string;
};

/** Explicit recipe used when a target lacks authoritative SEP-58 metadata. */
export type OutOfBandBuildRecipe = {
  readonly image: string;
  readonly arguments?: readonly string[];
  readonly options?: readonly string[];
  readonly metadata?: readonly ContractMetadataEntry[];
  readonly sourceSha256?: string;
};
