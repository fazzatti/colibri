import type { xdr } from "stellar-sdk";

/** @internal */
export type AuthEntryParams = {
  credentials: AuthEntryCredentialsParams;
  rootInvocation: InvocationParams;
};

/** @internal */
export type AuthEntryCredentialsParams =
  & AuthEntryAddressCredentialsParams
  & (
    | {
      type?: "address";
      delegates?: never;
    }
    | {
      type: "addressV2";
      delegates?: never;
    }
    | {
      type: "addressWithDelegates";
      delegates: AuthEntryDelegateParams[];
    }
  );

/** @internal */
export type AuthEntryAddressCredentialsParams = {
  address: string;
  nonce: string;
  signatureExpirationLedger: number;
  signature?: string;
};

/** @internal */
export type AuthEntryDelegateParams = {
  address: string;
  signature?: string;
  nestedDelegates?: AuthEntryDelegateParams[];
};

/** @internal */
export type InvocationParams = {
  function: {
    contractAddress: string;
    functionName: string;
    args: FnArg[] | xdr.ScVal[];
  };
  subInvocations?: InvocationParams[];
};

/** @internal */
export type FnArg = {
  value: unknown;
  type: ScValTypeName;
  /**
   * Exact base64-encoded ScVal XDR captured while parsing an auth entry.
   *
   * When present, auth-entry reconstruction prefers this representation over
   * the lossy native `value` projection. Caller-created arguments may omit it.
   */
  xdr?: string;
};

// ============================================================================
// Parsed ScVal Types (TypeScript-friendly)
// ============================================================================

/**
 * The TypeScript-native result of parsing any ScVal.
 * This is a recursive type that represents all possible Soroban values
 * in their most natural TypeScript form.
 */
/** @internal */
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
/** @internal */
export interface ScValMap extends Map<ScValParsed, ScValParsed> {}

/** Object with string keys (structs, maps with symbol keys) */
/** @internal */
export interface ScValRecord {
  [key: string]: ScValParsed;
}

// ============================================================================
// ScVal Type Names (for discrimination if needed)
// ============================================================================

/** @internal */
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
