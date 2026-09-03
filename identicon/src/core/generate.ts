import { StrKey } from "stellar-sdk";
import { colorFromHue } from "@/core/color.ts";
import type { IdenticonData, IdenticonMatrix } from "@/core/types.ts";
import { IdenticonCode, IdenticonError } from "@/error/index.ts";

const matrixFromBytes = (bytes: Uint8Array): IdenticonMatrix => {
  const rows = Array.from({ length: 7 }, () => Array<boolean>(7).fill(false));
  for (let bit = 0; bit < 28; bit++) {
    const row = Math.floor(bit / 4);
    const column = bit % 4;
    const filled = (bytes[1 + Math.floor(bit / 8)] & (128 >> (bit % 8))) !== 0;
    rows[row][column] = filled;
    rows[row][6 - column] = filled;
  }
  return Object.freeze(rows.map((row) => Object.freeze(row)));
};

/**
 * Generates immutable SEP-33 data using the established reference byte offset.
 *
 * Only checksummed Ed25519 G-addresses are accepted. Account existence and
 * network are irrelevant. Identicons are not cryptographic proof of identity.
 *
 * @param publicKey - Stellar Ed25519 public address.
 * @returns Frozen address, hue, default RGB color and 7×7 matrix.
 * @throws {IdenticonError} IDICON_001 for invalid or unsupported addresses.
 */
export const generateIdenticon = (publicKey: string): IdenticonData => {
  if (
    typeof publicKey !== "string" ||
    !StrKey.isValidEd25519PublicKey(publicKey)
  ) {
    throw new IdenticonError(
      IdenticonCode.INVALID_PUBLIC_KEY,
      "Expected a valid checksummed Stellar Ed25519 G-address.",
    );
  }
  // Lobstr slices the complete Base32 payload at [2,16). StrKey decoding
  // already removes its version byte, so the equivalent raw slice is [1,15).
  const bytes = StrKey.decodeEd25519PublicKey(publicKey).slice(1, 15);
  const hue = bytes[0] / 255;
  return Object.freeze({
    publicKey,
    hue,
    color: colorFromHue(hue, 0.7, 0.8),
    matrix: matrixFromBytes(bytes),
  });
};
