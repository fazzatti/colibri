import type { BinaryData } from "@/common/types/index.ts";
import { toBuffer } from "@/common/helpers/internal-buffer.ts";

/**
 * Converts any Colibri-supported binary input into a stable Uint8Array shape.
 *
 * This is the public binary normalization helper. Internal Stellar SDK
 * boundaries may still convert the result to Buffer without exposing that
 * package-specific type to Colibri consumers.
 */
export function normalizeBinaryData(value: BinaryData): Uint8Array {
  return toBuffer(value);
}
