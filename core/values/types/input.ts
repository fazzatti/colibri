import type { SorobanValue } from "@/values/value.ts";
import type {
  CustomSchema,
  CustomValue,
  OptionalOf,
  SchemaOf,
} from "@/values/types/shape.ts";
import type {
  SorobanBytesNInput,
  SorobanVoidInput,
} from "@/values/primitives.ts";
import type {
  SorobanMapInput,
  SorobanOptionInput,
  SorobanResultInput,
  SorobanVecInput,
} from "@/values/containers.ts";

/** Ordinary or validated vector, with correlated decoded element type. */
export type Vec<I, O = I> = SorobanVecInput<I, O>;
/** Native Map, entry pairs, or a validated map. */
export type Map<K, V, KO = K, VO = V> = SorobanMapInput<K, V, KO, VO>;
/** Optional input, including a validated option. */
export type Option<I, O = I> = SorobanOptionInput<I, O>;
/** Explicit raw or validated Result branches. */
export type Result<I, E, O = I, EO = E> = SorobanResultInput<I, E, O, EO>;
/** Fixed tuple input or a compatible validated tuple. */
export type Tuple<
  I extends readonly unknown[],
  O extends readonly unknown[] = I,
> =
  | { -readonly [K in keyof I]: I[K] }
  | SorobanValue<{ -readonly [K in keyof O]: O[K] }, "tuple">;
/** Raw bytes or a compatible wrapper; encoding enforces the declared length. */
export type BytesN<N extends number> = SorobanBytesNInput<N>;

/** Recursively derives the inputs accepted for a declared output type. */
export type Value<T> = [T] extends [never] ? never
  : [T] extends [null | undefined] ? SorobanVoidInput
  : [OptionalOf<T>] extends [never]
    ? [SchemaOf<T>] extends [never] ? T | SorobanValue<T>
    : FromSchema<SchemaOf<T>, T>
  : OptionalOf<T> extends { value: infer V } ? Option<Value<V>, V>
  : never;

/** Inputs for a Custom declaration, including nested primitive and custom wrappers. */
export type Custom<T> = Value<T>;

/** Positional input fields derived from their Soroban declarations. */
export type Fields<T> = { -readonly [K in keyof T]: Value<T[K]> };

/** Input derivation shared by all composed schema declarations. */
export type FromSchema<S, T> = S extends { kind: "scalar"; input: infer I } ? I
  : S extends { kind: "vec"; element: infer E } ? Vec<Value<E>, E>
  : S extends { kind: "map"; key: infer K; value: infer V }
    ? Map<Value<K>, Value<V>, K, V>
  : S extends { kind: "result"; ok: infer O; error: infer E }
    ? Result<Value<O>, Value<E>, O, E>
  : S extends { kind: "bytesN"; size: infer N extends number } ? BytesN<N>
  : S extends
    { kind: "tuple-value"; fields: infer F extends readonly unknown[] }
    ? Tuple<Fields<F>, F>
  : S extends CustomSchema ? CustomInput<S> | SorobanValue<T>
  : never;

/** Derives custom payload inputs without repeating the generated declaration. */
export type CustomInput<S extends CustomSchema> = S extends
  { kind: "struct" | "tuple"; fields: infer F } ? Fields<F>
  : S extends { kind: "enum"; encoding: "u32" } ? CustomValue<S>
  : S extends { kind: "enum"; encoding: "tagged"; variants: infer V } ? {
      [Tag in keyof V]: V[Tag] extends null ? { tag: Tag }
        : { tag: Tag; values: Fields<V[Tag]> };
    }[keyof V]
  : never;

/** Primitive inputs accept their ordinary representation or a compatible wrapper. */
export type {
  SorobanAddressInput as Address,
  SorobanBoolInput as Bool,
  SorobanBytesInput as Bytes,
  SorobanDurationInput as Duration,
  SorobanErrorInput as Error,
  SorobanI128Input as I128,
  SorobanI256Input as I256,
  SorobanI32Input as I32,
  SorobanI64Input as I64,
  SorobanMuxedAddressInput as MuxedAddress,
  SorobanStringInput as String,
  SorobanSymbolInput as Symbol,
  SorobanTimepointInput as Timepoint,
  SorobanU128Input as U128,
  SorobanU256Input as U256,
  SorobanU32Input as U32,
  SorobanU64Input as U64,
  SorobanValInput as Val,
  SorobanVoidInput as Void,
} from "@/values/primitives.ts";

// Preserve an empty ESM namespace when transpilers erase the type declarations.
export {};
