// ASSET CANONICAL STRING
/**
 * SEP-11 Asset String Format
 *
 * SEP-11 defines a standardized format for representing Stellar assets as strings.
 * Format: `CODE:ISSUER` for issued assets, or `native` for XLM.
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0011.md
 *
 * @module
 */

import { StrKey } from "@/strkeys/index.ts";
import { regex } from "@/common/regex/index.ts";
import type { StellarAssetCanonicalString } from "@/asset/sep11/types.ts";
/**
 * Check if a value is a valid SEP-11 StellarAssetCanonicalString.
 *
 * Valid formats:
 * - `"native"` - The native XLM asset
 * - `"CODE:ISSUER"` - Where CODE is 1-12 alphanumeric characters and
 *   ISSUER is a valid Stellar account ID (G...)
 *
 * @param value - The value to check
 * @returns True if the value is a valid SEP-11 asset string
 *
 * @example
 * isStellarAssetCanonicalString("native") // true
 * isStellarAssetCanonicalString("USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN") // true
 * isStellarAssetCanonicalString("invalid") // false
 * isStellarAssetCanonicalString("TOOLONGCODE:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN") // false
 */
export function isStellarAssetCanonicalString(
  value: unknown
): value is StellarAssetCanonicalString {
  if (typeof value !== "string") {
    return false;
  }

  // Native XLM
  if (value === "native") {
    return true;
  }

  // Must contain exactly one colon
  const colonIndex = value.indexOf(":");
  if (colonIndex === -1 || value.indexOf(":", colonIndex + 1) !== -1) {
    return false;
  }

  const code = value.slice(0, colonIndex);
  const issuer = value.slice(colonIndex + 1);

  // Asset code must be 1-12 alphanumeric characters
  if (code.length < 1 || code.length > 12) {
    return false;
  }
  // Asset code must be alphanumeric
  if (!regex.alphanumeric.test(code)) {
    return false;
  }

  // Issuer must be a valid Stellar account ID
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    return false;
  }

  return true;
}

/**
 * Parse a StellarAssetCanonicalString into its components.
 *
 * @param asset - A valid SEP-11 StellarAssetCanonicalString
 * @returns An object with `code` and `issuer` (or `{ code: "XLM", issuer: undefined }` for native)
 *
 * @example
 * parseStellarAssetCanonicalString("native")
 * // { code: "XLM", issuer: undefined }
 *
 * parseStellarAssetCanonicalString("USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
 * // { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" }
 */
export function parseStellarAssetCanonicalString(
  asset: StellarAssetCanonicalString
): {
  code: string;
  issuer: string | undefined;
} {
  if (asset === "native") {
    return { code: "XLM", issuer: undefined };
  }

  const colonIndex = asset.indexOf(":");
  return {
    code: asset.slice(0, colonIndex),
    issuer: asset.slice(colonIndex + 1),
  };
}

/**
 * Check if a SEP-11 StellarAssetCanonicalString is the native XLM asset.
 */
export function isNativeStellarAssetCanonicalString(
  asset: StellarAssetCanonicalString
): asset is "native" {
  return asset === "native";
}

/**
 * Create a SEP-11 StellarAssetCanonicalString from code and issuer.
 *
 * @param code - The asset code (or "XLM" / "native" for native)
 * @param issuer - The issuer account ID (optional for native)
 * @returns A SEP-11 formatted StellarAssetCanonicalString
 *
 * @example
 * toStellarAssetCanonicalString("XLM") // "native"
 * toStellarAssetCanonicalString("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
 * // "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
 */
export function toStellarAssetCanonicalString(
  code: string,
  issuer?: string
): StellarAssetCanonicalString {
  if (code === "XLM" || code === "native") {
    return "native";
  }

  if (!issuer) {
    throw new Error(`Issuer required for non-native asset: ${code}`);
  }

  return `${code}:${issuer}` as StellarAssetCanonicalString;
}
