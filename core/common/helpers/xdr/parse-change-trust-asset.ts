import { StrKey } from "@/strkeys/index.ts";
import { toStellarAssetCanonicalString } from "@/asset/sep11/index.ts";
import { UNKNOWN_CHANGE_TRUST_ASSET_TYPE } from "@/common/helpers/xdr/error.ts";
import type { StellarAssetCanonicalString } from "@/asset/sep11/types.ts";
import type { xdr } from "stellar-sdk";

/**
 * Liquidity pool share string format.
 * Format: `"pool:HEX_ENCODED_PARAMS"`
 */
export type LiquidityPoolShareString = `pool:${string}`;

/**
 * Return type for parseChangeTrustAsset.
 * Can be a SEP-11 asset string or a liquidity pool share string.
 */
export type ChangeTrustAssetString =
  | StellarAssetCanonicalString
  | LiquidityPoolShareString;

/**
 * Parse a ChangeTrustAsset XDR to a readable string format.
 *
 * ChangeTrustAsset can be a regular asset or a liquidity pool.
 *
 * @param assetXdr - ChangeTrustAsset XDR object
 * @returns Asset/pool string in format:
 * - `"native"` for XLM (SEP-11)
 * - `"CODE:ISSUER"` for credit assets (SEP-11)
 * - `"pool:HEX"` for liquidity pools
 *
 * @example
 * ```ts
 * parseChangeTrustAsset(asset); // "native", "USDC:GXXXX...", or "pool:abc123..."
 * ```
 * @internal
 */
export function parseChangeTrustAsset(
  assetXdr: xdr.ChangeTrustAsset
): ChangeTrustAssetString {
  const switchResult = assetXdr.switch();
  const assetType =
    typeof switchResult === "object" ? switchResult.name : switchResult;

  switch (assetType) {
    case "assetTypeNative":
      return "native";

    case "assetTypeCreditAlphanum4": {
      const asset = assetXdr.alphaNum4();
      const code = asset.assetCode().toString("utf8").replace(/\0/g, "");
      const issuer = StrKey.encodeEd25519PublicKey(asset.issuer().ed25519());
      return toStellarAssetCanonicalString(code, issuer);
    }

    case "assetTypeCreditAlphanum12": {
      const asset = assetXdr.alphaNum12();
      const code = asset.assetCode().toString("utf8").replace(/\0/g, "");
      const issuer = StrKey.encodeEd25519PublicKey(asset.issuer().ed25519());
      return toStellarAssetCanonicalString(code, issuer);
    }

    case "assetTypePoolShare": {
      const params = assetXdr.liquidityPool();
      // Liquidity pool ID would need to be computed from parameters
      // For now, return a generic identifier
      const paramsHex = Array.from(params.toXDR(), (b) =>
        b.toString(16).padStart(2, "0")
      ).join("");
      return `pool:${paramsHex}` as LiquidityPoolShareString;
    }

    default:
      throw new UNKNOWN_CHANGE_TRUST_ASSET_TYPE(String(assetType));
  }
}
