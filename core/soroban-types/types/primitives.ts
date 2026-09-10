// Reading these owned readonly static fields has no side effects.
// Pure wrappers let bundlers discard aliases that the consumer does not use.
import type { SorobanErrorValue } from "@/soroban-types/codecs/primitives.ts";
import type { Shape } from "@/soroban-types/types/schema.ts";
import {
  SorobanAddress,
  SorobanBool,
  SorobanBytes,
  SorobanDuration,
  SorobanError,
  SorobanI128,
  SorobanI256,
  SorobanI32,
  SorobanI64,
  SorobanMuxedAddress,
  SorobanString,
  SorobanSymbol,
  SorobanTimepoint,
  SorobanU128,
  SorobanU256,
  SorobanU32,
  SorobanU64,
  SorobanVal,
  SorobanVoid,
} from "@/soroban-types/values/primitives.ts";
import type {
  SorobanAddressInput,
  SorobanBoolInput,
  SorobanBytesInput,
  SorobanDurationInput,
  SorobanErrorInput,
  SorobanI128Input,
  SorobanI256Input,
  SorobanI32Input,
  SorobanI64Input,
  SorobanMuxedAddressInput,
  SorobanStringInput,
  SorobanSymbolInput,
  SorobanTimepointInput,
  SorobanU128Input,
  SorobanU256Input,
  SorobanU32Input,
  SorobanU64Input,
} from "@/soroban-types/values/primitives.ts";
/** Ordinary Bool representation with erased metadata for composed input types. */
export type Bool =
  & boolean
  & Shape<{ kind: "scalar"; input: SorobanBoolInput; output: boolean }>;
/** Validates, wraps, encodes and decodes Soroban Bool values. */
export const Bool: typeof SorobanBool.type =
  /* @__PURE__ */ (() => SorobanBool.type)();
/** Ordinary U32 representation with erased metadata for composed input types. */
export type U32 =
  & number
  & Shape<{ kind: "scalar"; input: SorobanU32Input; output: number }>;
/** Validates, wraps, encodes and decodes Soroban U32 values. */
export const U32: typeof SorobanU32.type =
  /* @__PURE__ */ (() => SorobanU32.type)();
/** Ordinary I32 representation with erased metadata for composed input types. */
export type I32 =
  & number
  & Shape<{ kind: "scalar"; input: SorobanI32Input; output: number }>;
/** Validates, wraps, encodes and decodes Soroban I32 values. */
export const I32: typeof SorobanI32.type =
  /* @__PURE__ */ (() => SorobanI32.type)();
/** Ordinary U64 representation with erased metadata for composed input types. */
export type U64 =
  & bigint
  & Shape<{ kind: "scalar"; input: SorobanU64Input; output: bigint }>;
/** Validates, wraps, encodes and decodes Soroban U64 values. */
export const U64: typeof SorobanU64.type =
  /* @__PURE__ */ (() => SorobanU64.type)();
/** Ordinary I64 representation with erased metadata for composed input types. */
export type I64 =
  & bigint
  & Shape<{ kind: "scalar"; input: SorobanI64Input; output: bigint }>;
/** Validates, wraps, encodes and decodes Soroban I64 values. */
export const I64: typeof SorobanI64.type =
  /* @__PURE__ */ (() => SorobanI64.type)();
/** Ordinary U128 representation with erased metadata for composed input types. */
export type U128 =
  & bigint
  & Shape<{ kind: "scalar"; input: SorobanU128Input; output: bigint }>;
/** Validates, wraps, encodes and decodes Soroban U128 values. */
export const U128: typeof SorobanU128.type =
  /* @__PURE__ */ (() => SorobanU128.type)();
/** Ordinary I128 representation with erased metadata for composed input types. */
export type I128 =
  & bigint
  & Shape<{ kind: "scalar"; input: SorobanI128Input; output: bigint }>;
/** Validates, wraps, encodes and decodes Soroban I128 values. */
export const I128: typeof SorobanI128.type =
  /* @__PURE__ */ (() => SorobanI128.type)();
/** Ordinary U256 representation with erased metadata for composed input types. */
export type U256 =
  & bigint
  & Shape<{ kind: "scalar"; input: SorobanU256Input; output: bigint }>;
/** Validates, wraps, encodes and decodes Soroban U256 values. */
export const U256: typeof SorobanU256.type =
  /* @__PURE__ */ (() => SorobanU256.type)();
/** Ordinary I256 representation with erased metadata for composed input types. */
export type I256 =
  & bigint
  & Shape<{ kind: "scalar"; input: SorobanI256Input; output: bigint }>;
/** Validates, wraps, encodes and decodes Soroban I256 values. */
export const I256: typeof SorobanI256.type =
  /* @__PURE__ */ (() => SorobanI256.type)();
/** Ordinary Timepoint representation with erased metadata for composed input types. */
export type Timepoint =
  & bigint
  & Shape<{ kind: "scalar"; input: SorobanTimepointInput; output: bigint }>;
/** Validates, wraps, encodes and decodes Soroban Timepoint values. */
export const Timepoint: typeof SorobanTimepoint.type =
  /* @__PURE__ */ (() => SorobanTimepoint.type)();
/** Ordinary Duration representation with erased metadata for composed input types. */
export type Duration =
  & bigint
  & Shape<{ kind: "scalar"; input: SorobanDurationInput; output: bigint }>;
/** Validates, wraps, encodes and decodes Soroban Duration values. */
export const Duration: typeof SorobanDuration.type =
  /* @__PURE__ */ (() => SorobanDuration.type)();
/** Ordinary Symbol representation with erased metadata for composed input types. */
export type Symbol =
  & string
  & Shape<{ kind: "scalar"; input: SorobanSymbolInput; output: string }>;
/** Validates, wraps, encodes and decodes Soroban Symbol values. */
export const Symbol: typeof SorobanSymbol.type =
  /* @__PURE__ */ (() => SorobanSymbol.type)();
/** Ordinary String representation with erased metadata for composed input types. */
export type String =
  & string
  & Shape<{ kind: "scalar"; input: SorobanStringInput; output: string }>;
/** Validates, wraps, encodes and decodes Soroban String values. */
export const String: typeof SorobanString.type =
  /* @__PURE__ */ (() => SorobanString.type)();
/** Ordinary Bytes representation with erased metadata for composed input types. */
export type Bytes =
  & Uint8Array
  & Shape<{ kind: "scalar"; input: SorobanBytesInput; output: Uint8Array }>;
/** Validates, wraps, encodes and decodes Soroban Bytes values. */
export const Bytes: typeof SorobanBytes.type =
  /* @__PURE__ */ (() => SorobanBytes.type)();
/** Ordinary Address representation with erased metadata for composed input types. */
export type Address =
  & string
  & Shape<{ kind: "scalar"; input: SorobanAddressInput; output: string }>;
/** Validates, wraps, encodes and decodes Soroban Address values. */
export const Address: typeof SorobanAddress.type =
  /* @__PURE__ */ (() => SorobanAddress.type)();
/** Ordinary MuxedAddress representation with erased metadata for composed input types. */
export type MuxedAddress =
  & string
  & Shape<{ kind: "scalar"; input: SorobanMuxedAddressInput; output: string }>;
/** Validates, wraps, encodes and decodes Soroban MuxedAddress values. */
export const MuxedAddress: typeof SorobanMuxedAddress.type =
  /* @__PURE__ */ (() => SorobanMuxedAddress.type)();
/** Ordinary Error representation with erased metadata for composed input types. */
export type Error =
  & SorobanErrorValue
  & Shape<
    { kind: "scalar"; input: SorobanErrorInput; output: SorobanErrorValue }
  >;
/** Validates, wraps, encodes and decodes Soroban Error values. */
export const Error: typeof SorobanError.type =
  /* @__PURE__ */ (() => SorobanError.type)();
/** Dynamically decoded native value; its representation is determined at runtime. */
export type Val = unknown;
/** Validates, wraps, encodes and decodes Soroban Val values. */
export const Val: typeof SorobanVal.type =
  /* @__PURE__ */ (() => SorobanVal.type)();
/** Ordinary void value; also marks a payload-free enum variant. */
export type Void = null;
/** Validates and encodes void values. */
export const Void: typeof SorobanVoid.type =
  /* @__PURE__ */ (() => SorobanVoid.type)();
