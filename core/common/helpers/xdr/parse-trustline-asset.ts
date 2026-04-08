import { Buffer } from "buffer";
import { StrKey } from "@/strkeys/index.ts";
import { toStellarAssetCanonicalString } from "@/asset/sep11/index.ts";
import type { ChangeTrustAssetString } from "@/common/helpers/xdr/parse-change-trust-asset.ts";
import type { xdr } from "stellar-sdk";

/**
 * Parse a TrustLineAsset XDR to a readable string format.
 *
 * Unlike ChangeTrustAsset, pool-share trustlines carry a liquidity-pool id,
 * not the original parameter payload.
 *
 * @param assetXdr - TrustLineAsset XDR object.
 * @returns Asset/pool string in a friendly format.
 *
 * @internal
 */
export function parseTrustLineAsset(
  assetXdr: xdr.TrustLineAsset,
): ChangeTrustAssetString {
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

    case "assetTypePoolShare":
      return `pool:${StrKey.encodeLiquidityPool(Buffer.from(assetXdr.liquidityPoolId() as unknown as Uint8Array))}`;

    default:
      throw new Error(`Unsupported trustline asset type: ${assetXdr.switch().name}`);
  }
}
