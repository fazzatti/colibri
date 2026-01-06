/**
 * Type guard for SEP-10 challenge transactions.
 */

import type { Transaction } from "stellar-sdk";

/** Suffix for the home domain auth key */
const AUTH_KEY_SUFFIX = " auth";

/** Expected nonce length (48 random bytes base64 encoded = 64 bytes) */
const EXPECTED_NONCE_LENGTH = 64;

/**
 * Checks if a Transaction object has the structure of a SEP-10 challenge.
 *
 * This performs structural validation only (no signature verification):
 * - Sequence number is 0
 * - Has time bounds
 * - Has at least one operation
 * - First operation is ManageData with key ending in " auth"
 * - First operation has a source account (client)
 * - First operation value (nonce) is 64 bytes
 * - Memo (if present) is type ID
 * - No memo if client is a muxed account
 *
 * @param transaction - The Transaction object to check
 * @returns true if the transaction has challenge structure, false otherwise
 *
 * @example
 * ```typescript
 * import { isChallengeTransaction } from "@colibri/sep10";
 *
 * if (isChallengeTransaction(tx)) {
 *   // tx looks like a SEP-10 challenge
 *   const challenge = SEP10Challenge.fromTransaction(tx, networkPassphrase);
 * }
 * ```
 */
export function isChallengeTransaction(transaction: Transaction): boolean {
  // Check sequence number
  if (transaction.sequence !== "0") {
    return false;
  }

  // Check time bounds
  if (!transaction.timeBounds) {
    return false;
  }

  // Check operations exist
  if (transaction.operations.length === 0) {
    return false;
  }

  // Check first operation is ManageData
  const firstOp = transaction.operations[0];
  if (firstOp.type !== "manageData") {
    return false;
  }

  // Check first operation has source
  if (!firstOp.source) {
    return false;
  }

  // Check first operation key ends with " auth"
  if (!firstOp.name.endsWith(AUTH_KEY_SUFFIX)) {
    return false;
  }

  // Check nonce length
  const nonceValue = firstOp.value;
  if (!nonceValue || nonceValue.length !== EXPECTED_NONCE_LENGTH) {
    return false;
  }

  // Check memo type (if present)
  if (transaction.memo.type !== "none" && transaction.memo.type !== "id") {
    return false;
  }

  // Check muxed account with memo
  if (transaction.memo.type === "id" && firstOp.source.startsWith("M")) {
    return false;
  }

  return true;
}
