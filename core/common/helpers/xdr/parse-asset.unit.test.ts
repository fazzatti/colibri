import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { Asset, Keypair } from "stellar-sdk";
import { parseAsset } from "@/common/helpers/xdr/parse-asset.ts";
import { UNKNOWN_ASSET_TYPE } from "@/common/helpers/xdr/error.ts";

describe("parseAsset", () => {
  it("should parse native asset", () => {
    const asset = Asset.native();
    const result = parseAsset(asset.toXDRObject());
    assertEquals(result, "native");
  });

  it("should parse AlphaNum4 asset", () => {
    const issuer = Keypair.random();
    const asset = new Asset("USDC", issuer.publicKey());

    const result = parseAsset(asset.toXDRObject());
    assertEquals(result, `USDC:${issuer.publicKey()}`);
  });

  it("should parse AlphaNum12 asset", () => {
    const issuer = Keypair.random();
    const asset = new Asset("LONGASSETNAM", issuer.publicKey());

    const result = parseAsset(asset.toXDRObject());
    assertEquals(result, `LONGASSETNAM:${issuer.publicKey()}`);
  });

  it("should handle asset code with trailing nulls", () => {
    const issuer = Keypair.random();
    // Short asset code that gets padded with nulls
    const asset = new Asset("USD", issuer.publicKey());

    const result = parseAsset(asset.toXDRObject());
    assertEquals(result, `USD:${issuer.publicKey()}`);
  });

  it("should throw UNKNOWN_ASSET_TYPE for invalid asset type", () => {
    // Create a mock asset with an unknown type
    const mockAsset = {
      switch: () => ({ name: "assetTypeUnknown", value: 99 }),
    };

    assertThrows(
      // deno-lint-ignore no-explicit-any
      () => parseAsset(mockAsset as any),
      UNKNOWN_ASSET_TYPE,
      "Unknown asset type"
    );
  });
});
