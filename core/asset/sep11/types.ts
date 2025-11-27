/**
 * SEP-11 asset string format.
 *
 * Examples:
 * - `"native"` for XLM
 * - `"USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"`
 * - `"KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE"`
 */
export type SEP11Asset = `${string}:${string}` | "native";
