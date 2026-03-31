import { StrKey } from "@/strkeys/index.ts";
import { toStellarAssetCanonicalString } from "@/asset/sep11/index.ts";
import { UNKNOWN_ASSET_TYPE } from "@/common/helpers/xdr/error.ts";
import type { StellarAssetCanonicalString } from "@/asset/sep11/types.ts";
import type { xdr } from "stellar-sdk";

/**
 * Parse an Asset XDR to a SEP-11 canonical string format.
 *
 * @param assetXdr - Asset XDR object
 * @returns SEP-11 StellarAssetCanonicalString:
 * - `"native"` for XLM
 * - `"CODE:ISSUER"` for credit assets
 *
 * @example
 * ```ts
 * parseAsset(asset); // "native" or "USDC:GXXXX..."
 * ```
 * @internal
 */
export function parseAsset(assetXdr: xdr.Asset): StellarAssetCanonicalString {
  switch (assetXdr.switch().name) {
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

    default:
      throw new UNKNOWN_ASSET_TYPE(assetXdr.switch().name);
  }
}
