import type { BinaryData } from "@/common/types/index.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";

/**
 * Converts any Colibri-supported binary input into a stable Uint8Array shape.
 *
 * @param value - Binary input such as ArrayBuffer, Uint8Array, DataView, or any
 * ArrayBufferView.
 * @returns A defensive copy of the input bytes as a Uint8Array.
 *
 * This is the public binary normalization helper. Stellar SDK 17 boundaries
 * consume `Uint8Array` directly, so callers never need a Node `Buffer`.
 */
export function normalizeBinaryData(value: BinaryData): Uint8Array {
  return toUint8Array(value).slice();
}
