/**
 * Validated Soroban values without Colibri's RPC, pipeline or client initialization.
 * @module
 */
export * from "@/values/index.ts";
/** Direct declarations support namespace imports without a forwarded runtime object. */
export * from "@/values/types/index.ts";
/** Named namespace convenience; direct namespace imports enable finer tree shaking. */
export * as SorobanType from "@/values/types/index.ts";

export type { ScValLike } from "@/common/types/external.ts";

export { ColibriError } from "@/error/index.ts";
export type * from "@/error/types.ts";

/** Native contract spec type used when binding a custom schema. */
export type { Spec } from "@/contract/spec.ts";

/** Input derivation utilities shared with the Input namespace. */
export type {
  BytesN as BytesNInput,
  CustomInput,
  Fields as InputFields,
  FromSchema as InputFromSchema,
  Map as MapInput,
  Option as OptionInput,
  Result as ResultInput,
  Tuple as TupleInput,
  Value as InputOf,
  Vec as VecInput,
} from "@/values/types/input.ts";
