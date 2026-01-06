/**
 * Type guard for SEP-10 challenge XDR strings.
 */

import { type Transaction, TransactionBuilder } from "stellar-sdk";
import { isChallengeTransaction } from "@/utils/is-challenge-transaction.ts";

/**
 * Checks if an XDR string can be parsed as a SEP-10 challenge.
 *
 * This attempts to decode the XDR and validate the challenge structure.
 * Does not verify signatures.
 *
 * @param xdr - Base64-encoded transaction envelope XDR
 * @param networkPassphrase - The Stellar network passphrase
 * @returns true if the XDR is a valid challenge structure, false otherwise
 *
 * @example
 * ```typescript
 * import { isChallengeXDR } from "@colibri/sep10";
 *
 * if (isChallengeXDR(xdrString, Networks.TESTNET)) {
 *   // xdrString is a valid SEP-10 challenge
 *   const challenge = SEP10Challenge.fromXDR(xdrString, Networks.TESTNET);
 * }
 * ```
 */
export function isChallengeXDR(
  xdr: string,
  networkPassphrase: string
): boolean {
  try {
    const transaction = TransactionBuilder.fromXDR(
      xdr,
      networkPassphrase
    ) as Transaction;
    return isChallengeTransaction(transaction);
  } catch {
    return false;
  }
}
