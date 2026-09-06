import { assertEquals, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Asset } from "stellar-sdk";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";
import { createSep29Plugin } from "@colibri/plugin-sep29";
import { StellarAsset } from "@/asset/stellar/index.ts";
import { NativeLiquidityPool } from "@/markets/liquidity-pools/index.ts";
import { SDEX } from "@/markets/sdex/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { NativeAccount } from "@/account/native/index.ts";

describe("Native transaction clients preserve pipeline plugin composition", () => {
  it("attaches the actual plugins in constructor order and retains the callable pipeline", () => {
    const networkConfig = NetworkConfig.TestNet();
    const signer = LocalSigner.generateRandom();
    const channel = createChannelAccountsPlugin({
      channels: [NativeAccount.fromMasterSigner(signer)],
    });
    const feeBump = createFeeBumpPlugin({
      networkConfig,
      feeBumpConfig: {
        source: signer.publicKey(),
        signers: [signer],
        fee: "200",
      },
    });
    const memoRequired = createSep29Plugin();
    const plugins = { transactionPipe: [channel, feeBump, memoRequired] };
    const asset = new Asset("USD", signer.publicKey());
    for (
      const client of [
        new StellarAsset({ asset, networkConfig, plugins }),
        new NativeLiquidityPool({
          assets: [asset, Asset.native()],
          networkConfig,
          plugins,
        }),
        new SDEX({ networkConfig, plugins }),
      ]
    ) {
      assertEquals(typeof client.transactionPipe, "function");
      assertEquals(client.transactionPipe.plugins.length, 3);
      const attached = client.transactionPipe.plugins as readonly unknown[];
      assertStrictEquals(attached[0], channel);
      assertStrictEquals(attached[1], feeBump);
      assertStrictEquals(attached[2], memoRequired);
    }
  });
});
