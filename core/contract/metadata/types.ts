/** One ordered SEP-46 metadata entry decoded from contract Wasm. */
export type ContractMetadataEntry = {
  /** Metadata key. */
  readonly key: string;
  /** Metadata value. */
  readonly value: string;
  /** Zero-based `contractmetav0` section index. */
  readonly sectionIndex: number;
  /** Zero-based entry index within its section. */
  readonly entryIndex: number;
};

/** One `contractmetav0` custom section and its ordered entries. */
export type ContractMetadataSection = {
  /** Zero-based section index in Wasm custom-section order. */
  readonly index: number;
  /** Entries decoded from this section in stream order. */
  readonly entries: readonly ContractMetadataEntry[];
};

/** Complete SEP-46 metadata extracted from contract Wasm. */
export type ContractMetadata = {
  /** Every `contractmetav0` section, including empty sections. */
  readonly sections: readonly ContractMetadataSection[];
  /** All entries concatenated in section and entry order. */
  readonly entries: readonly ContractMetadataEntry[];
};

/** One valid SEP identifier declared by a SEP-47 metadata occurrence. */
export type SepClaim = {
  /** Claimed SEP number with leading zeros removed by numeric parsing. */
  readonly sep: number;
  /** Zero-based item position in the comma-separated metadata value. */
  readonly valueIndex: number;
  /** SEP-46 metadata entry carrying this declaration. */
  readonly metadata: ContractMetadataEntry;
};

/** Why one item in a SEP-47 metadata value was not accepted as a claim. */
export type InvalidSepClaimReason =
  | "empty"
  | "invalid-identifier"
  | "unsafe-identifier";

/** One malformed SEP identifier preserved for diagnostics. */
export type InvalidSepClaim = {
  /** Unmodified item from the comma-separated metadata value. */
  readonly value: string;
  /** Reason the item is not a valid SEP-47 identifier. */
  readonly reason: InvalidSepClaimReason;
  /** Zero-based item position in the comma-separated metadata value. */
  readonly valueIndex: number;
  /** SEP-46 metadata entry carrying this item. */
  readonly metadata: ContractMetadataEntry;
};

/** Parsed SEP-47 declarations, including raw occurrences and diagnostics. */
export type SepClaimAnalysis = {
  /** Unique valid SEP numbers in first-declaration order. */
  readonly seps: readonly number[];
  /** Every valid claim occurrence, including duplicates. */
  readonly claims: readonly SepClaim[];
  /** Every malformed comma-separated item. */
  readonly invalidClaims: readonly InvalidSepClaim[];
};
