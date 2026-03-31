import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  type NetworkConfig as NetworkConfigType,
  StrKey,
  type TransactionConfig,
} from "@colibri/core";
import { StellarTestLedger } from "@colibri/test-tooling";
import { Server } from "stellar-sdk/rpc";
import { ChannelAccounts } from "@/index.ts";

describe("ChannelAccounts integration", disableSanitizeConfig, () => {
  const ledger = new StellarTestLedger({
    containerName: `colibri-plugin-channel-accounts-${crypto.randomUUID()}`,
    containerImageVersion: "latest",
    logLevel: "silent",
  });

  const sponsor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

  let networkConfig: NetworkConfigType;
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
    await ledger.start();

    const networkDetails = await ledger.getNetworkDetails();
    networkConfig = NetworkConfig.CustomNet(networkDetails);
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

  afterAll(async () => {
    await ledger.stop();
    await ledger.destroy();
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
