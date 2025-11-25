import type { TOID } from "@/toid/types.ts";

/**
 * Checks if a string is a valid SEP-0035 Operation ID (TOID).
 *
 * A valid TOID must be a string representation of a 64-bit signed integer
 * (positive value between 0 and 9,223,372,036,854,775,807).
 *
 * @param id - The string to validate.
 * @returns True if the string is a valid TOID, false otherwise.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md#specification
 */
export function isTOID(id: string): id is TOID {
  if (!/^\d+$/.test(id)) return false;

  try {
    const val = BigInt(id);
    return val >= 0n && val <= 9223372036854775807n;
  } catch {
    return false;
  }
}

/**
 * Generates a TOID (Total Order ID) from its component parts.
 *
 * Based on SEP-0035:
 * - Bits 0-31: Ledger Sequence (32 bits)
 * - Bits 32-51: Transaction Application Order (20 bits, starts at 1)
 * - Bits 52-63: Operation Index (12 bits, starts at 1)
 *
 * @param ledgerSequence - The ledger sequence number (max 2,147,483,647)
 * @param transactionOrder - The transaction application order within the ledger (1-based, max 1,048,575)
 * @param operationIndex - The operation index within the transaction (1-based, max 4,095)
 * @returns A 19-character zero-padded TOID string
 * @throws Error if any parameter exceeds its maximum value
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md#specification
 *
 * @example
 * const toid = createTOID(123456, 1, 1);
 * // Returns: "0000530242871959553" (19 characters, zero-padded)
 */
export function createTOID(
  ledgerSequence: number,
  transactionOrder: number,
  operationIndex: number
): TOID {
  // Validate bounds
  if (ledgerSequence < 0 || ledgerSequence > 2147483647) {
    throw new Error(
      `Ledger sequence out of range: ${ledgerSequence} (max 2,147,483,647)`
    );
  }
  if (transactionOrder < 1 || transactionOrder > 1048575) {
    throw new Error(
      `Transaction order out of range: ${transactionOrder} (1-1,048,575)`
    );
  }
  if (operationIndex < 1 || operationIndex > 4095) {
    throw new Error(
      `Operation index out of range: ${operationIndex} (1-4,095)`
    );
  }

  // Shift operation index to 0-based for bit packing (matches RPC behavior)
  // Transaction order stays as-is (1-based in both input and packing)
  const opIndex0 = operationIndex - 1;

  // Pack into 64-bit integer using BigInt for precision
  const toid =
    (BigInt(ledgerSequence) << 32n) |
    (BigInt(transactionOrder) << 12n) |
    BigInt(opIndex0);

  // Return as 19-character zero-padded string
  return toid.toString().padStart(19, "0") as TOID;
}

/**
 * Parses a TOID back into its component parts.
 * Returns 1-based indices to match SEP-0035 spec language.
 *
 * @param toid - A valid TOID string
 * @returns Object containing ledgerSequence, transactionOrder (1-based), and operationIndex (1-based)
 * @throws Error if the TOID is invalid
 *
 * @example
 * const parts = parseTOID("0000530242871959552");
 * // Returns: { ledgerSequence: 123456, transactionOrder: 1, operationIndex: 1 }
 */
export function parseTOID(toid: string): {
  ledgerSequence: number;
  transactionOrder: number;
  operationIndex: number;
} {
  if (!isTOID(toid)) {
    throw new Error(`Invalid TOID: ${toid}`);
  }

  const val = BigInt(toid);

  // Extract components using bit masking
  const opIndex0 = Number(val & 0xfffn); // 12 bits (0-based in TOID)
  const transactionOrder = Number((val >> 12n) & 0xfffffn); // 20 bits (1-based, as stored)
  const ledgerSequence = Number(val >> 32n); // 32 bits

  // Return with operation index converted to 1-based
  return {
    ledgerSequence,
    transactionOrder,
    operationIndex: opIndex0 + 1,
  };
}
