import { Buffer } from "buffer";
import type { BinaryData } from "@/common/types/index.ts";

/**
 * Converts Colibri-supported binary input into the Buffer shape expected by
 * Stellar SDK helpers. Keep this helper internal so the public API stays
 * decoupled from a specific `buffer` package version.
 */
export function toBuffer(value: BinaryData): Buffer {
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}
