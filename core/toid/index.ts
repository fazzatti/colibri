import type { Sep35OperationId, TOID } from "@/toid/types.ts";
import * as ERROR from "@/toid/error.ts";
import { assert } from "@/common/assert/assert.ts";

/**
 * Checks if a string is in the shared signed 64-bit identifier range.
 *
 * A valid TOID must be a string representation of a 64-bit signed integer
 * (positive value between 0 and 9,223,372,036,854,775,807).
 *
 * @param id - The string to validate.
 * @returns True if the string is a valid TOID, false otherwise.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md#specification
 */
export function isTOID(id: string): id is TOID {
  if (id.length === 0 || /\D/.test(id)) return false;

  try {
    const val = BigInt(id);
    return val >= 0n && val <= 9223372036854775807n;
  } catch {
    return false;
  }
}

/**
 * Generates Colibri's historical RPC-compatible TOID from one-based components.
 * Use createSep35OperationId for standard SEP-35 packing.
 *
 * Historical RPC packing (preserved for existing event identifiers):
 * - Upper 32 bits: Ledger sequence
 * - Next 20 bits: Transaction application order, starting at 1
 * - Lower 12 bits: Operation index minus one
 *
 * @param ledgerSequence - The ledger sequence number (max 2,147,483,647)
 * @param transactionOrder - The transaction application order within the ledger (1-based, max 1,048,575)
 * @param operationIndex - The operation index within the transaction (1-based, max 4,095)
 * @returns A 19-character zero-padded TOID string.
 * @throws Error if any parameter exceeds its maximum value
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md#specification
 *
 * @example
 * const toid = createTOID(123456, 1, 1);
 * // Returns: "0000530239482499072" (19 characters, zero-padded)
 */
export function createTOID(
  ledgerSequence: number,
  transactionOrder: number,
  operationIndex: number,
): TOID {
  // Validate bounds
  assert(
    Number.isInteger(ledgerSequence) && ledgerSequence >= 0 &&
      ledgerSequence <= 2147483647,
    new ERROR.LEDGER_OUT_OF_RANGE(ledgerSequence),
  );

  assert(
    Number.isInteger(transactionOrder) && transactionOrder >= 1 &&
      transactionOrder <= 1048575,
    new ERROR.TX_ORDER_OUT_OF_RANGE(transactionOrder),
  );

  assert(
    Number.isInteger(operationIndex) && operationIndex >= 1 &&
      operationIndex <= 4095,
    new ERROR.OP_INDEX_OUT_OF_RANGE(operationIndex),
  );

  // Shift operation index to 0-based for bit packing (matches RPC behavior)
  // Transaction order stays as-is (1-based in both input and packing)
  const opIndex0 = operationIndex - 1;

  // Pack into 64-bit integer using BigInt for precision
  const toid = (BigInt(ledgerSequence) << 32n) |
    (BigInt(transactionOrder) << 12n) |
    BigInt(opIndex0);

  // Return as 19-character zero-padded string
  return toid.toString().padStart(19, "0") as TOID;
}

/**
 * Parses a TOID back into its component parts.
 * Reverses the historical RPC offset. Use parseSep35OperationId for SEP-35.
 *
 * @param toid - A valid TOID string
 * @returns Object containing ledgerSequence, transactionOrder (1-based), and operationIndex (1-based)
 * @throws Error if the TOID is invalid
 *
 * @example
 * const parts = parseTOID("0000530239482499072");
 * // Returns: { ledgerSequence: 123456, transactionOrder: 1, operationIndex: 1 }
 */
export function parseTOID(toid: string): {
  ledgerSequence: number;
  transactionOrder: number;
  operationIndex: number;
} {
  assert(isTOID(toid), new ERROR.INVALID_TOID(toid));

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

/**
 * Packs a SEP-35 operation ID with the one-based operation index unchanged.
 * Returns a 19-digit decimal string. Existing event IDs/cursors are unaffected.
 * @param ledgerSequence - Ledger sequence, 0 through 2147483647.
 * @param transactionOrder - One-based transaction order, through 1048575.
 * @param operationIndex - One-based operation index, through 4095.
 * @returns The standards-correct operation ID.
 */
export function createSep35OperationId(
  ledgerSequence: number,
  transactionOrder: number,
  operationIndex: number,
): Sep35OperationId {
  // Reuse the established integer/range checks without changing historical IDs.
  return (BigInt(createTOID(ledgerSequence, transactionOrder, operationIndex)) +
    1n).toString().padStart(19, "0") as Sep35OperationId;
}

/**
 * Unpacks a SEP-35 operation ID, rejecting reserved zero transaction/operation fields.
 * @param id - Decimal operation ID within the signed 64-bit range.
 * @returns Ledger sequence and the original one-based transaction/operation indices.
 */
export function parseSep35OperationId(
  id: string,
): {
  ledgerSequence: number;
  transactionOrder: number;
  operationIndex: number;
} {
  assert(isTOID(id), new ERROR.INVALID_TOID(id));
  const value = BigInt(id);
  const operationIndex = Number(value & 0xfffn);
  const transactionOrder = Number((value >> 12n) & 0xfffffn);
  assert(
    operationIndex > 0 && transactionOrder > 0,
    new ERROR.INVALID_TOID(id),
  );
  return {
    ledgerSequence: Number(value >> 32n),
    transactionOrder,
    operationIndex,
  };
}
