import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  ColibriError,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  NetworkType,
  type TransactionConfig,
} from "@colibri/core";
import * as E from "@/shared/error.ts";
import type { ChannelAccount } from "@/shared/types.ts";
import { ChannelAccounts } from "@/tools/channel-accounts.ts";

const sponsor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const channel = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const networkConfig = NetworkConfig.TestNet();

const config: TransactionConfig = {
  fee: "100",
  timeout: 30,
  source: sponsor.address(),
  signers: [sponsor.signer()],
};

const createBrokenSponsor = (): ChannelAccount =>
  ({
    address() {
      throw new Error("broken sponsor");
    },
    signer() {
      return sponsor.signer();
    },
  }) as unknown as ChannelAccount;

const createBrokenChannel = (): ChannelAccount =>
  ({
    address() {
      throw new Error("broken channel");
    },
    signer() {
      return channel.signer();
    },
  }) as unknown as ChannelAccount;

describe("ChannelAccounts unit behavior", () => {
  it("rethrows Colibri errors raised while opening channels", async () => {
    const error = await assertRejects(
      async () =>
        await ChannelAccounts.open({
          numberOfChannels: 1,
          sponsor,
          networkConfig: {} as never,
          config,
        }),
      ColibriError,
    );

    assertEquals(error instanceof E.UNEXPECTED_ERROR, false);
  });

  it("wraps unexpected errors raised while opening channels", async () => {
    await assertRejects(
      async () =>
        await ChannelAccounts.open({
          numberOfChannels: 1,
          sponsor: createBrokenSponsor(),
          networkConfig,
          config,
        }),
      E.UNEXPECTED_ERROR,
    );
  });

  it("returns early when closing an empty channel list", async () => {
    const result = await ChannelAccounts.close({
      channels: [],
      sponsor,
      networkConfig,
      config,
    });

    assertEquals(result, undefined);
  });

  it("rethrows Colibri errors raised while closing channels", async () => {
    const error = await assertRejects(
      async () =>
        await ChannelAccounts.close({
          channels: [channel],
          sponsor,
          networkConfig: {} as never,
          config,
        }),
      ColibriError,
    );

    assertEquals(error instanceof E.UNEXPECTED_ERROR, false);
  });

  it("wraps unexpected errors raised while closing channels", async () => {
    const networkConfigWithoutAllowHttp = NetworkConfig.CustomNet({
      type: NetworkType.TESTNET,
      networkPassphrase: networkConfig.networkPassphrase,
      rpcUrl: networkConfig.rpcUrl,
      horizonUrl: networkConfig.horizonUrl,
      friendbotUrl: networkConfig.friendbotUrl,
    });

    await assertRejects(
      async () =>
        await ChannelAccounts.close({
          channels: [createBrokenChannel()],
          sponsor,
          networkConfig: networkConfigWithoutAllowHttp,
          config,
        }),
      E.UNEXPECTED_ERROR,
    );
  });
});
