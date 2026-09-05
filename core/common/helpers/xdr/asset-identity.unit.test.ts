import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Asset, Keypair } from "stellar-sdk";
import { toStellarAssetCanonicalString } from "@/asset/sep11/index.ts";
import { parseAsset } from "@/common/helpers/xdr/parse-asset.ts";
import { parseChangeTrustAsset } from "@/common/helpers/xdr/parse-change-trust-asset.ts";
import { parseTrustLineAsset } from "@/common/helpers/xdr/parse-trustline-asset.ts";

describe("native and issued asset identity", () => {
  it("preserves code and issuer in every asset XDR parser, including native-looking codes", () => {
    for (
      const issuer of [
        Keypair.random().publicKey(),
        Keypair.random().publicKey(),
      ]
    ) {
      for (const code of ["XLM", "native", "USDC", "LONGASSET"]) {
        const asset = new Asset(code, issuer);
        const expected = `${code}:${issuer}`;
        assertEquals(asset.isNative(), false);
        assertEquals(toStellarAssetCanonicalString(code, issuer), expected);
        assertEquals(parseAsset(asset.toXdrObject()), expected);
        assertEquals(
          parseChangeTrustAsset(asset.toChangeTrustXDRObject()),
          expected,
        );
        assertEquals(
          parseTrustLineAsset(asset.toTrustLineXDRObject()),
          expected,
        );
      }
    }
  });

  it("keeps issuer-less native shorthand and actual native XDR", () => {
    assertEquals(toStellarAssetCanonicalString("XLM"), "native");
    assertEquals(toStellarAssetCanonicalString("native"), "native");
    assertEquals(parseAsset(Asset.native().toXdrObject()), "native");
  });
});
