/**
 * Runtime validation and XDR conversion for Soroban types.
 *
 * A codec describes one type and can be reused across many values. It validates
 * inputs, encodes them as ScVal, and decodes ScVal into JavaScript values.
 * Calling `.from()` creates a SorobanValue. Primitive and collection rules compose;
 * custom codecs and factories derive their rules from a contract spec without
 * loading a contract or contacting a network.
 *
 * @example
 * ```ts
 * import { SorobanType } from "@colibri/core/values";
 * const codec = SorobanType.Vec(SorobanType.U32);
 * const encoded = codec.encode([1, 2]);
 * console.log(codec.decode(encoded));
 * ```
 *
 * @module
 */
export { SorobanCodec } from "@/soroban-types/codecs/codec.ts";
export {
  createSorobanType,
  sorobanTypeFromSpec,
} from "@/soroban-types/codecs/custom.ts";
export {
  createSorobanFactory,
  createSorobanUnion,
} from "@/soroban-types/codecs/factories.ts";
export type {
  SorobanFactory,
  SorobanUnionFactory,
} from "@/soroban-types/codecs/factories.ts";
export type { SorobanErrorValue } from "@/soroban-types/codecs/primitives.ts";
