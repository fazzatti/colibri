import type { ContractId } from "@/strkeys/types.ts";

/** Optional emitting-contract restriction, applied to decoding and full filters. */
export type ContractEventOptions = {
  /** Restricts accepted occurrences and generated filters to this contract. */
  contractId?: ContractId;
  /** Map payload fields: tolerant evolution by default, or an exact field set. */
  dataFields?: "evolution" | "strict";
  /** Nested named structs: tolerant evolution by default, or an exact field set. */
  structFields?: "evolution" | "strict";
};
/** Deterministic property name for a declaration, including repeated ABI names. */
export type ContractEventBinding = {
  /** Original event name from the spec. */
  name: string;
  /** Zero-based occurrence among declarations with the same name. */
  occurrence: number;
  /** Collision-free property exposed by the registry and generated bindings. */
  key: string;
};
