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

/**
 * SEP-11 asset string format.
 *
 * Examples:
 * - `"native"` for XLM
 * - `"USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"`
 * - `"KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE"`
 */
export type SEP11Asset = `${string}:${string}` | "native";

/**
 * Check if a value is a valid SEP-11 asset string.
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
 * isSEP11Asset("native") // true
 * isSEP11Asset("USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN") // true
 * isSEP11Asset("invalid") // false
 * isSEP11Asset("TOOLONGCODE:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN") // false
 */
export function isSEP11Asset(value: unknown): value is SEP11Asset {
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
 * Parse a SEP-11 asset string into its components.
 *
 * @param asset - A valid SEP-11 asset string
 * @returns An object with `code` and `issuer` (or `{ code: "XLM", issuer: undefined }` for native)
 *
 * @example
 * parseSEP11Asset("native")
 * // { code: "XLM", issuer: undefined }
 *
 * parseSEP11Asset("USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
 * // { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" }
 */
export function parseSEP11Asset(asset: SEP11Asset): {
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
 * Check if a SEP-11 asset is the native XLM asset.
 */
export function isNativeSEP11Asset(asset: SEP11Asset): asset is "native" {
  return asset === "native";
}

/**
 * Create a SEP-11 asset string from code and issuer.
 *
 * @param code - The asset code (or "XLM" / "native" for native)
 * @param issuer - The issuer account ID (optional for native)
 * @returns A SEP-11 formatted asset string
 *
 * @example
 * toSEP11Asset("XLM") // "native"
 * toSEP11Asset("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")
 * // "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
 */
export function toSEP11Asset(code: string, issuer?: string): SEP11Asset {
  if (code === "XLM" || code === "native") {
    return "native";
  }

  if (!issuer) {
    throw new Error(`Issuer required for non-native asset: ${code}`);
  }

  return `${code}:${issuer}` as SEP11Asset;
}
