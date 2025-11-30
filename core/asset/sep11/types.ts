/**
 * Stellar asset canonical string representation
 * following the SEP-11 standard.
 * It can be either "native" for XLM or "CODE:ISSUER"
 * for issued assets.
 *
 * Examples:
 * - `"native"` for XLM
 * - `"USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"`
 * - `"KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE"`
 */
export type StellarAssetCanonicalString = `${string}:${string}` | "native";
