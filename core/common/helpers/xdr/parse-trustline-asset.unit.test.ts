import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Asset, Keypair, xdr } from "stellar-sdk";
import { parseTrustLineAsset } from "@/common/helpers/xdr/parse-trustline-asset.ts";

describe("parseTrustLineAsset", () => {
  it("parses native assets", () => {
    const asset = Asset.native();
    const result = parseTrustLineAsset(
      asset.toTrustLineXDRObject() as xdr.TrustLineAsset,
    );

    assertEquals(result, "native");
  });

  it("parses alpha-num assets", () => {
    const issuer = Keypair.random().publicKey();

    const alpha4 = parseTrustLineAsset(
      new Asset("USD", issuer).toTrustLineXDRObject() as xdr.TrustLineAsset,
    );
    const alpha12 = parseTrustLineAsset(
      new Asset("LONGASSETNAM", issuer)
        .toTrustLineXDRObject() as xdr.TrustLineAsset,
    );

    assertEquals(alpha4, `USD:${issuer}`);
    assertEquals(alpha12, `LONGASSETNAM:${issuer}`);
  });

  it("parses liquidity-pool share assets", () => {
    const poolId = new Uint8Array(32).fill(9);
    const asset = xdr.TrustLineAsset.assetTypePoolShare(
      poolId as unknown as xdr.PoolId,
    );

    const result = parseTrustLineAsset(asset);

    assertStringIncludes(result, "pool:");
  });

  it("throws for unsupported trustline asset types", () => {
    assertThrows(
      () =>
        parseTrustLineAsset(
          {
            switch: () => ({ name: "unknownAssetType" }),
          } as unknown as xdr.TrustLineAsset,
        ),
      Error,
      "Unsupported trustline asset type",
    );
  });
});
