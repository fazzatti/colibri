import type { ContractId } from "@/strkeys/types.ts";

/** Optional emitting-contract restriction, applied to decoding and full filters. */
export type ContractEventOptions = { contractId?: ContractId };
/** Deterministic property name for a declaration, including repeated ABI names. */
export type ContractEventBinding = {
  /** Original event name from the spec. */
  name: string;
  /** Zero-based occurrence among declarations with the same name. */
  occurrence: number;
  /** Collision-free property exposed by the registry and generated bindings. */
  key: string;
};
