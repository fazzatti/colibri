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
 * Generates immutable SEP-33 account data, with a Colibri C-address extension.
 *
 * Checksummed G-addresses use the established Lobstr-compatible byte offset.
 * C-addresses apply the same algorithm to the 32-byte contract ID, not its Wasm
 * hash. Contract identicons are a Colibri extension, not defined by SEP-33.
 * No network lookup or account/contract existence check is performed. Identical
 * G/C payloads produce identical images; distinct payloads can also collide.
 * An identicon is a visual aid, not cryptographic proof of identity.
 *
 * @param publicKey - A checksummed Stellar G-address or C-address.
 * @returns Frozen address, hue, default RGB color and 7×7 matrix.
 * @throws {IdenticonError} IDICON_001 for invalid or unsupported addresses.
 */
export const generateIdenticon = (publicKey: string): IdenticonData => {
  const isAccount = typeof publicKey === "string" &&
    StrKey.isValidEd25519PublicKey(publicKey);
  const isContract = typeof publicKey === "string" &&
    StrKey.isValidContract(publicKey);
  if (!isAccount && !isContract) {
    throw new IdenticonError(
      IdenticonCode.INVALID_PUBLIC_KEY,
      "Expected a valid checksummed Stellar G-address or C-address.",
    );
  }
  // Lobstr slices the complete Base32 payload at [2,16). StrKey decoding
  // already removes its version byte, so the equivalent raw slice is [1,15).
  const bytes =
    (isAccount
      ? StrKey.decodeEd25519PublicKey(publicKey)
      : StrKey.decodeContract(publicKey)).slice(1, 15);
  const hue = bytes[0] / 255;
  return Object.freeze({
    publicKey,
    hue,
    color: colorFromHue(hue, 0.7, 0.8),
    matrix: matrixFromBytes(bytes),
  });
};
