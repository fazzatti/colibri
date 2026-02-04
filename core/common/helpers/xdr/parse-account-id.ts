import { StrKey } from "@/strkeys/index.ts";
import type { xdr } from "stellar-sdk";

/**
 * Parse an AccountID XDR to a Stellar address (G...).
 *
 * @param accountXdr - AccountID XDR object
 * @returns Stellar public key address starting with 'G'
 *
 * @example
 * ```ts
 * parseAccountId(account); // "GXXXX..."
 * ```
 */
export function parseAccountId(accountXdr: xdr.AccountId): string {
  return StrKey.encodeEd25519PublicKey(accountXdr.ed25519());
}
