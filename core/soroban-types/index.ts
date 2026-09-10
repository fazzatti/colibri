/**
 * Soroban type declarations, reusable codecs and validated values.
 *
 * The types entrypoint supplies the SorobanType namespace. Codecs define runtime
 * validation and conversion rules; values hold validated snapshots and provide
 * JavaScript and XDR access. These modules also support standalone ledger inspection.
 * Contract function encoding lives in contract/encoding and consumes this layer.
 * The supported @colibri/core and @colibri/core/values imports share these exports.
 *
 * @example
 * ```ts
 * import { SorobanType } from "@colibri/core/values";
 * const role = SorobanType.Symbol.from("ADMIN");
 * console.log(role.value, role.toScVal());
 * ```
 *
 * @module
 */
export {
  SorobanAddress,
  SorobanBool,
  SorobanBytes,
  SorobanBytesN,
  SorobanContractInstance,
  SorobanDuration,
  SorobanError,
  SorobanExecutableTag,
  SorobanI128,
  SorobanI256,
  SorobanI32,
  SorobanI64,
  SorobanLedgerKeyContractInstance,
  SorobanLedgerKeyNonce,
  SorobanMap,
  SorobanMuxedAddress,
  SorobanOption,
  SorobanResult,
  SorobanString,
  SorobanSymbol,
  SorobanTimepoint,
  SorobanTuple,
  SorobanU128,
  SorobanU256,
  SorobanU32,
  SorobanU64,
  SorobanVal,
  SorobanValue,
  SorobanVec,
  SorobanVoid,
  toSorobanScVal,
} from "@/soroban-types/values/index.ts";
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
  SorobanMapInput,
  SorobanMuxedAddressInput,
  SorobanOptionInput,
  SorobanResultInput,
  SorobanResultValue,
  SorobanScValInput,
  SorobanStringInput,
  SorobanSymbolInput,
  SorobanTimepointInput,
  SorobanTupleInput,
  SorobanTupleOutput,
  SorobanTypeInput,
  SorobanTypeOutput,
  SorobanU128Input,
  SorobanU256Input,
  SorobanU32Input,
  SorobanU64Input,
  SorobanValInput,
  SorobanVecInput,
  SorobanVoidInput,
} from "@/soroban-types/values/index.ts";
export {
  createSorobanFactory,
  createSorobanType,
  createSorobanUnion,
  SorobanCodec,
  sorobanTypeFromSpec,
} from "@/soroban-types/codecs/index.ts";
export type {
  SorobanErrorValue,
  SorobanFactory,
  SorobanUnionFactory,
} from "@/soroban-types/codecs/index.ts";
export {
  SorobanValueError,
  SorobanValueErrorCode,
} from "@/soroban-types/error.ts";
