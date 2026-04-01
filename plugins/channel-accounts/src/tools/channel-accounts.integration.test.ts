import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import {
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  StrKey,
  type TransactionConfig,
} from "@colibri/core";
import { Server } from "stellar-sdk/rpc";
import { ChannelAccounts } from "@/index.ts";

describe("[Testnet] ChannelAccounts integration", disableSanitizeConfig, () => {
  const sponsor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const networkConfig = NetworkConfig.TestNet();

  let sponsorConfig: TransactionConfig;
  let rpc: Server;

  const fund = async (
    account: ReturnType<typeof NativeAccount.fromMasterSigner>,
  ) =>
    await initializeWithFriendbot(
      networkConfig.friendbotUrl!,
      account.address(),
      {
        rpcUrl: networkConfig.rpcUrl!,
        allowHttp: networkConfig.allowHttp,
      },
  );

  beforeAll(async () => {
    rpc = new Server(networkConfig.rpcUrl!, {
      allowHttp: networkConfig.allowHttp ?? false,
    });

    await fund(sponsor);

    sponsorConfig = {
      fee: "10000000",
      timeout: 30,
      source: sponsor.address(),
      signers: [sponsor.signer()],
    };
  });

  describe("ChannelAccounts", () => {
    it("opens and closes sponsored channel accounts", async () => {
      const channels = await ChannelAccounts.open({
        numberOfChannels: 2,
        sponsor,
        networkConfig,
        config: sponsorConfig,
        rpc,
      });

      assertEquals(channels.length, 2);
      const accountEntries = await Promise.all(
        channels.map((channel) => rpc.getAccountEntry(channel.address())),
      );
      assertEquals(
        accountEntries.map((entry) => entry.balance().toString()),
        ["0", "0"],
      );

      await ChannelAccounts.close({
        channels,
        sponsor,
        networkConfig,
        config: sponsorConfig,
        rpc,
      });

      await assertRejects(
        async () => await rpc.getAccount(channels[0].address()),
      );
      await assertRejects(
        async () => await rpc.getAccount(channels[1].address()),
      );
    });

    it("can add the sponsor as a full signer on the opened channel", async () => {
      const [channel] = await ChannelAccounts.open({
        numberOfChannels: 1,
        sponsor,
        setSponsorAsSigner: true,
        networkConfig,
        config: sponsorConfig,
        rpc,
      });

      try {
        const accountEntry = await rpc.getAccountEntry(channel.address());
        const [signer] = accountEntry.signers();

        assertExists(signer);
        assertEquals(accountEntry.signers().length, 1);
        assertEquals(signer.weight(), 1);
        assertEquals(
          StrKey.encodeEd25519PublicKey(signer.key().ed25519()),
          sponsor.address(),
        );
      } finally {
        await ChannelAccounts.close({
          channels: [channel],
          sponsor,
          networkConfig,
          config: sponsorConfig,
          rpc,
        });
      }
    });
  });
});
