/**
 * Safe parser for SEP-10 challenge transactions.
 */

import type { Transaction } from "stellar-sdk";
import { SEP10Challenge } from "@/challenge/challenge.ts";

/**
 * Attempts to parse a Transaction as a SEP-10 challenge.
 * Returns null instead of throwing if the transaction is invalid.
 *
 * @param transaction - A Stellar Transaction object
 * @param networkPassphrase - The Stellar network passphrase
 * @returns A SEP10Challenge instance if valid, null otherwise
 *
 * @example
 * ```typescript
 * import { parseChallengeTransaction } from "@colibri/sep10";
 *
 * const challenge = parseChallengeTransaction(tx, Networks.TESTNET);
 * if (challenge) {
 *   // Successfully parsed
 *   console.log(challenge.homeDomain);
 * }
 * ```
 */
export function parseChallengeTransaction(
  transaction: Transaction,
  networkPassphrase: string
): SEP10Challenge | null {
  try {
    return SEP10Challenge.fromTransaction(transaction, networkPassphrase);
  } catch {
    return null;
  }
}
