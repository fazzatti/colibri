// ============================================================================
// Parsed ScVal Types (TypeScript-friendly)
// ============================================================================

/**
 * The TypeScript-native result of parsing any ScVal.
 * This is a recursive type that represents all possible Soroban values
 * in their most natural TypeScript form.
 */
export type ScValParsed =
  | null // void
  | boolean // bool
  | number // u32, i32
  | bigint // u64, i64, u128, i128, u256, i256, timepoint, duration
  | string // symbol, string, address (as strkey)
  | Uint8Array // bytes, bytesN
  | ScValParsed[] // vec, tuple
  | ScValMap // map with non-string keys
  | ScValRecord; // map with string keys, struct

/** Map with arbitrary key types */
export interface ScValMap extends Map<ScValParsed, ScValParsed> {}

/** Object with string keys (structs, maps with symbol keys) */
export interface ScValRecord {
  [key: string]: ScValParsed;
}

// ============================================================================
// ScVal Type Names (for discrimination if needed)
// ============================================================================

export type ScValTypeName =
  | "void"
  | "bool"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "u128"
  | "i128"
  | "u256"
  | "i256"
  | "timepoint"
  | "duration"
  | "symbol"
  | "string"
  | "bytes"
  | "address"
  | "vec"
  | "map"
  | "error"
  | "contractInstance"
  | "ledgerKeyContractInstance"
  | "ledgerKeyNonce";
