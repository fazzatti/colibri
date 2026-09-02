import type { BinaryData } from "@/common/types/index.ts";

/** Converts Colibri-supported binary input into a Uint8Array view. */
export function toUint8Array(value: BinaryData): Uint8Array {
  return value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}
