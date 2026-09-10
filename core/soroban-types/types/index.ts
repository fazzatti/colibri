/**
 * The SorobanType namespace: descriptive types and matching runtime helpers.
 *
 * Names such as U32 describe ordinary JavaScript values in type annotations and
 * expose reusable codecs at runtime. Input derives accepted raw or wrapped values;
 * Custom describes struct, tuple and enum shapes, with factories bound to their
 * contract spec. Type annotations do not execute validation: use `.from()` to
 * create a validated value. Generated NameArgs aliases describe factory inputs;
 * contract methods keep their MethodInput names.
 *
 * @example
 * ```ts
 * import * as SorobanType from "@colibri/core/values";
 * const count: SorobanType.U32 = 7;
 * const input: SorobanType.Input.U32 = SorobanType.U32.from(count);
 * console.log(SorobanType.U32.from(input).value);
 * ```
 *
 * @module
 */
export {
  Address,
  Bool,
  Bytes,
  Duration,
  Error,
  I128,
  I256,
  I32,
  I64,
  MuxedAddress,
  String,
  Symbol,
  Timepoint,
  U128,
  U256,
  U32,
  U64,
  Val,
  Void,
} from "@/soroban-types/types/primitives.ts";
export {
  BytesN,
  Map,
  Option,
  Result,
  Tuple,
  Vec,
} from "@/soroban-types/types/collections.ts";
export { Custom } from "@/soroban-types/types/custom.ts";
export type { Factory } from "@/soroban-types/types/custom.ts";
export {
  ContractInstance,
  ExecutableTag,
  LedgerKeyContractInstance,
  LedgerKeyNonce,
} from "@/soroban-types/types/system.ts";
export { optional, shape } from "@/soroban-types/types/schema.ts";
export type {
  CustomSchema,
  CustomValue,
  Optional,
  OptionalOf,
  SchemaOf,
  Shape,
} from "@/soroban-types/types/schema.ts";
/** Accepted primitive and composed inputs, including validated wrappers. */
export * as Input from "@/soroban-types/types/inputs.ts";
export { SorobanValue as Value } from "@/soroban-types/values/value.ts";

/** Declared error codes selected from the existing categorized contract error map. */
export type ErrorCode<Errors, Category extends string> = {
  [Code in keyof Errors]: Errors[Code] extends { category: Category }
    ? Code extends number ? Code
    : Code extends `${infer N extends number}` ? N
    : never
    : never;
}[keyof Errors];
