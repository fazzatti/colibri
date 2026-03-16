/**
 * Safe parser for SEP-10 challenge XDR strings.
 */

import { SEP10Challenge } from "@/challenge/challenge.ts";

/**
 * Attempts to parse an XDR string as a SEP-10 challenge.
 * Returns null instead of throwing if the XDR is invalid.
 *
 * @param xdr - Base64-encoded transaction envelope XDR
 * @param networkPassphrase - The Stellar network passphrase
 * @returns A SEP10Challenge instance if valid, null otherwise
 *
 * @example
 * ```typescript
 * import { parseChallengeXDR } from "@colibri/sep10";
 *
 * const challenge = parseChallengeXDR(xdrString, Networks.TESTNET);
 * if (challenge) {
 *   // Successfully parsed
 *   console.log(challenge.homeDomain);
 * } else {
 *   // Not a valid challenge
 * }
 * ```
 */
export function parseChallengeXDR(
  xdr: string,
  networkPassphrase: string
): SEP10Challenge | null {
  try {
    return SEP10Challenge.fromXDR(xdr, networkPassphrase);
  } catch {
    return null;
  }
}
