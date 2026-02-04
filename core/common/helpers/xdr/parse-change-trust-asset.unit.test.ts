import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { Asset, Keypair, xdr } from "stellar-sdk";
import { parseChangeTrustAsset } from "@/common/helpers/xdr/parse-change-trust-asset.ts";
import { UNKNOWN_CHANGE_TRUST_ASSET_TYPE } from "@/common/helpers/xdr/error.ts";

describe("parseChangeTrustAsset", () => {
  it("should parse native asset", () => {
    const asset = Asset.native();
    const changeTrustAsset = asset.toChangeTrustXDRObject();

    const result = parseChangeTrustAsset(changeTrustAsset);
    assertEquals(result, "native");
  });

  it("should parse AlphaNum4 asset", () => {
    const issuer = Keypair.random();
    const asset = new Asset("USDC", issuer.publicKey());
    const changeTrustAsset = asset.toChangeTrustXDRObject();

    const result = parseChangeTrustAsset(changeTrustAsset);
    assertEquals(result, `USDC:${issuer.publicKey()}`);
  });

  it("should parse AlphaNum12 asset", () => {
    const issuer = Keypair.random();
    const asset = new Asset("LONGASSETNAM", issuer.publicKey());
    const changeTrustAsset = asset.toChangeTrustXDRObject();

    const result = parseChangeTrustAsset(changeTrustAsset);
    assertEquals(result, `LONGASSETNAM:${issuer.publicKey()}`);
  });

  it("should handle asset code with trailing nulls", () => {
    const issuer = Keypair.random();
    const asset = new Asset("USD", issuer.publicKey());
    const changeTrustAsset = asset.toChangeTrustXDRObject();

    const result = parseChangeTrustAsset(changeTrustAsset);
    assertEquals(result, `USD:${issuer.publicKey()}`);
  });

  it("should parse liquidity pool share", () => {
    const issuer = Keypair.random();
    const assetA = Asset.native();
    const assetB = new Asset("USDC", issuer.publicKey());

    // Create liquidity pool parameters
    const constantProductParams =
      new xdr.LiquidityPoolConstantProductParameters({
        assetA: assetA.toXDRObject(),
        assetB: assetB.toXDRObject(),
        fee: 30, // 0.3%
      });

    const liquidityPoolParams =
      xdr.LiquidityPoolParameters.liquidityPoolConstantProduct(
        constantProductParams
      );

    const changeTrustAsset =
      xdr.ChangeTrustAsset.assetTypePoolShare(liquidityPoolParams);

    const result = parseChangeTrustAsset(changeTrustAsset);
    assertStringIncludes(result, "pool:");
  });

  it("should throw UNKNOWN_CHANGE_TRUST_ASSET_TYPE for invalid asset type", () => {
    // Create a mock change trust asset with an unknown type
    const mockAsset = {
      switch: () => ({ name: "assetTypeUnknown", value: 99 }),
    };

    assertThrows(
      // deno-lint-ignore no-explicit-any
      () => parseChangeTrustAsset(mockAsset as any),
      UNKNOWN_CHANGE_TRUST_ASSET_TYPE,
      "Unknown ChangeTrustAsset type"
    );
  });

  it("should handle switch result as string (non-object)", () => {
    // Some XDR versions may return the type name directly as a string
    const mockAsset = {
      switch: () => "assetTypeNative", // Returns string instead of object
    };

    // deno-lint-ignore no-explicit-any
    const result = parseChangeTrustAsset(mockAsset as any);
    assertEquals(result, "native");
  });
});
