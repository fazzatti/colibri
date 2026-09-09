// Reading these owned readonly static fields has no side effects.
// Pure wrappers let bundlers discard aliases that the consumer does not use.
import {
  SorobanMap,
  SorobanOption,
  SorobanResult,
  SorobanTuple,
  SorobanVec,
} from "@/values/containers.ts";
import { SorobanBytesN } from "@/values/primitives.ts";
import type { Optional, Shape } from "@/values/types/shape.ts";
import type { SorobanResultValue } from "@/values/containers.ts";

/** Decoded vector whose element type remains available for input derivation. */
export type Vec<T> = T[] & Shape<{ kind: "vec"; element: T; output: T[] }>;
/** Builds a vector codec, including for empty vectors. */
export const Vec: typeof SorobanVec.type =
  /* @__PURE__ */ (() => SorobanVec.type)();
/** Decoded map entries, ordered by Soroban key comparison. */
export type Map<K, V> =
  & Array<[K, V]>
  & Shape<{ kind: "map"; key: K; value: V; output: Array<[K, V]> }>;
/** Builds a map codec that orders keys and rejects duplicates. */
export const Map: typeof SorobanMap.type =
  /* @__PURE__ */ (() => SorobanMap.type)();
/** Decoded positional fields, retaining tuple arity. */
export type Tuple<T extends readonly unknown[]> =
  & { -readonly [K in keyof T]: T[K] }
  & Shape<{ kind: "tuple-value"; fields: T; output: T }>;
/** Builds a codec for a fixed tuple of field codecs. */
export const Tuple: typeof SorobanTuple.type =
  /* @__PURE__ */ (() => SorobanTuple.type)();
/** Optional value; None has the protocol's void representation. */
export type Option<T> = Optional<T>;
/** Builds an optional-value codec. */
export const Option: typeof SorobanOption.type =
  /* @__PURE__ */ (() => SorobanOption.type)();
/** Explicit Result branches for composition; top-level SDK results stay unchanged. */
export type Result<T, E> =
  & SorobanResultValue<T, E>
  & Shape<
    { kind: "result"; ok: T; error: E; output: SorobanResultValue<T, E> }
  >;
/** Builds a Result codec, using ScError for the error branch. */
export const Result: typeof SorobanResult.type =
  /* @__PURE__ */ (() => SorobanResult.type)();
/** Fixed-length bytes described by the contract declaration. */
export type BytesN<N extends number> =
  & Uint8Array
  & Shape<{ kind: "bytesN"; size: N; output: Uint8Array }>;
/** Builds a byte codec that validates the exact declared length. */
export const BytesN: typeof SorobanBytesN.type =
  /* @__PURE__ */ (() => SorobanBytesN.type)();
