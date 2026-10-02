import { assertEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { Asset, Keypair, xdr } from "stellar-sdk";
import { NativeLiquidityPool } from "@/markets/liquidity-pools/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { StellarAsset } from "@/asset/native/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const issuerA = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const issuerB = "GA2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD6N";
const networkConfig = NetworkConfig.TestNet();

describe("SDK 17.2.1 asset identity regressions", () => {
  it("orders equal-code issuers by public-key bytes and derives the protocol pool ID", () => {
    const a = new Asset("USD", issuerA);
    const b = new Asset("USD", issuerB);
    const assets: [Asset, Asset] = [b, a];
    const pool = new NativeLiquidityPool({ assets, networkConfig });
    assertEquals(assets, [b, a]);
    assertEquals(pool.assetA.getIssuer(), issuerA);
    assertEquals(pool.assetB.getIssuer(), issuerB);
    assertEquals(
      pool.poolId,
      "LDGVZBU5O7J7SUOMG2J6XBQI722B7VTOVJEZM7CAFUZFMEO5RFFKSNUW",
    );
    assertEquals(
      pool.priceBounds({
        baseAsset: a,
        quoteAsset: b,
        minimum: "2",
        maximum: "4",
      }),
      { minPrice: { n: 1, d: 4 }, maxPrice: { n: 1, d: 2 } },
    );
    assertEquals(
      new NativeLiquidityPool({ assets: [a, b], networkConfig }).poolId,
      pool.poolId,
    );
    assertEquals(
      new NativeLiquidityPool({ assets: [a, Asset.native()], networkConfig })
        .assetA.isNative(),
      true,
    );
  });
  it("preserves a short-code alphanum12 arm across native and Colibri copies", () => {
    const wire = xdr.Asset.assetTypeCreditAlphanum12(
      new xdr.AlphaNum12({
        assetCode: new Uint8Array([85, 83, 68, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        issuer: Keypair.fromPublicKey(issuerA).xdrAccountId(),
      }),
    );
    const asset = Asset.fromOperation(wire);
    const client = new StellarAsset({ asset, networkConfig });
    assertEquals(client.asset.toXdrObject().toXdr(), wire.toXdr());
    const pool = new NativeLiquidityPool({
      assets: [asset, Asset.native()],
      networkConfig,
    });
    assertEquals(pool.assetB.toXdrObject().toXdr(), wire.toXdr());
    assertEquals(
      pool.poolShareAsset.assetB.toXdrObject().toXdr(),
      wire.toXdr(),
    );
    // Human-readable SEP-11 identity cannot express the XDR union arm.
    assertEquals(client.toString(), `USD:${issuerA}`);
  });
});
