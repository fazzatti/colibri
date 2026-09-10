/**
 * Concrete validated Soroban values and their named constructors.
 *
 * A value holds an immutable XDR snapshot and the codec that validated it.
 * Use `.value` for a detached JavaScript representation, `.toScVal()` for
 * Stellar SDK interoperability, or `.toXdr()` for serialization. Codecs own
 * the validation rules; the SorobanType namespace supplies descriptive types
 * and convenient factories. Creating a value requires no contract or network.
 *
 * @example
 * ```ts
 * import { SorobanType } from "@colibri/core/values";
 * const count = SorobanType.U32.from(7);
 * console.log(count.value, count.toXdr("base64"));
 * ```
 *
 * @module
 */
export { SorobanValue, toSorobanScVal } from "@/soroban-types/values/value.ts";
export type { SorobanScValInput } from "@/soroban-types/values/value.ts";
export {
  SorobanAddress,
  SorobanBool,
  SorobanBytes,
  SorobanBytesN,
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
export type {
  SorobanAddressInput,
  SorobanBoolInput,
  SorobanBytesInput,
  SorobanBytesNInput,
  SorobanDurationInput,
  SorobanErrorInput,
  SorobanFixedBytes,
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
  SorobanValInput,
  SorobanVoidInput,
} from "@/soroban-types/values/primitives.ts";
export {
  SorobanMap,
  SorobanOption,
  SorobanResult,
  SorobanTuple,
  SorobanVec,
} from "@/soroban-types/values/collections.ts";
export type {
  SorobanMapInput,
  SorobanOptionInput,
  SorobanResultInput,
  SorobanTupleInput,
  SorobanTupleOutput,
  SorobanTypeInput,
  SorobanTypeOutput,
  SorobanVecInput,
} from "@/soroban-types/values/collections.ts";
export {
  SorobanContractInstance,
  SorobanExecutableTag,
  SorobanLedgerKeyContractInstance,
  SorobanLedgerKeyNonce,
} from "@/soroban-types/values/system.ts";
export type { SorobanResultValue } from "@/soroban-types/codecs/collections.ts";
