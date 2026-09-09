import { Spec as NativeSpec } from "stellar-sdk/contract";
import type { Result as NativeResult } from "stellar-sdk/contract";

/** @internal Canonical native instance; keep public aliases analyzable by supported Deno versions. */
type NativeSpecInstance = NativeSpec;
/** @internal Exact native constructor signature, including static helpers. */
type SpecConstructor = typeof NativeSpec;
/** @internal Exact native result contract; retain upstream type interoperability. */
type NativeContractResult<T, E extends { message: string }> = NativeResult<
  T,
  E
>;

/**
 * Stellar contract specification used by Colibri's contract, error and event APIs.
 * This is the native SDK type; existing native specs remain interchangeable.
 */
export type Spec = NativeSpecInstance;

/**
 * Native Stellar spec constructor, exposed through Colibri without a wrapper.
 * Accepts base64 entries, XDR entries, or an encoded spec stream. Static
 * `fromWasm` and the native encoding, decoding and inspection methods are retained.
 * @example
 * ```ts
 * import { Spec } from "@colibri/core";
 * const spec = new Spec([]);
 * console.log(spec.funcs());
 * ```
 */
export const Spec: SpecConstructor = NativeSpec;

/**
 * Native decoded contract Result. `isOk()`/`isErr()` inspect the outcome;
 * `unwrap()` returns T or throws, and `unwrapErr()` returns E or throws.
 * The decoder constructs the native SDK implementation; no conversion is added.
 */
export type Result<T, E extends { message: string } = { message: string }> =
  NativeContractResult<T, E>;
