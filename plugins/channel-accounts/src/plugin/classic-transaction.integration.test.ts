import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals, assertExists } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  type NetworkConfig as NetworkConfigType,
  type TransactionConfig,
} from "@colibri/core";
import { StellarTestLedger } from "@colibri/test-tooling";
import {
  Operation,
  type Transaction,
  TransactionBuilder,
  type xdr,
} from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import {
  type ChannelAccount,
  ChannelAccounts,
  createChannelAccountsPlugin,
} from "@/index.ts";

const asEnvelopeXdr = (
  envelopeXdr: string | xdr.TransactionEnvelope,
): string =>
  typeof envelopeXdr === "string" ? envelopeXdr : envelopeXdr.toXDR("base64");

const parseSubmittedTransaction = (
  envelopeXdr: string | xdr.TransactionEnvelope,
  networkPassphrase: string,
): Transaction =>
  TransactionBuilder.fromXDR(
    asEnvelopeXdr(envelopeXdr),
    networkPassphrase,
  ) as Transaction;

const sortAddresses = (addresses: readonly string[]) => [...addresses].sort();

describe(
  "ClassicTransaction channel accounts integration",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName:
        `colibri-plugin-channel-accounts-classic-${crypto.randomUUID()}`,
      containerImageVersion: "latest",
      logLevel: "silent",
    });

    const sponsor = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom(),
    );
    const actor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

    let networkConfig: NetworkConfigType;
    let sponsorConfig: TransactionConfig;
    let actorConfig: TransactionConfig;
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

    const closeChannels = async (channels: readonly ChannelAccount[]) => {
      if (channels.length === 0) return;

      await ChannelAccounts.close({
        channels,
        sponsor,
        networkConfig,
        config: sponsorConfig,
        rpc,
      });
    };

    beforeAll(async () => {
      await ledger.start();

      const networkDetails = await ledger.getNetworkDetails();
      networkConfig = NetworkConfig.CustomNet(networkDetails);
      rpc = new Server(networkConfig.rpcUrl!, {
        allowHttp: networkConfig.allowHttp ?? false,
      });

      await fund(sponsor);
      await fund(actor);

      sponsorConfig = {
        fee: "10000000",
        timeout: 30,
        source: sponsor.address(),
        signers: [sponsor.signer()],
      };

      actorConfig = {
        fee: "10000000",
        timeout: 30,
        source: actor.address(),
        signers: [actor.signer()],
      };
    });

    afterAll(async () => {
      await ledger.stop();
      await ledger.destroy();
    });

    it("uses a registered channel account as transaction source", async () => {
      const channels = await ChannelAccounts.open({
        numberOfChannels: 1,
        sponsor,
        networkConfig,
        config: sponsorConfig,
        rpc,
      });

      try {
        const [channel] = channels;
        const plugin = createChannelAccountsPlugin({
          channels,
        });

        const pipeline = createClassicTransactionPipeline({
          networkConfig,
          rpc,
        });
        pipeline.use(plugin);

        const result = await pipeline.run({
          operations: [
            Operation.setOptions({
              source: actor.address(),
              homeDomain: "channel-accounts.test",
            }),
          ],
          config: actorConfig,
        });

        assertExists(result);
        assertExists(result.hash);
        assertExists(result.response);

        const transaction = parseSubmittedTransaction(
          result.response.envelopeXdr,
          networkConfig.networkPassphrase,
        );

        assertEquals(transaction.source, channel.address());
        assertEquals(transaction.operations[0].source, actor.address());
        assertEquals(
          plugin.getChannels().map((item) => item.address()),
          [channel.address()],
        );
      } finally {
        await closeChannels(channels);
      }
    });

    it("handles 10 channels with 10 transactions in parallel and then continues", async () => {
      const channels = await ChannelAccounts.open({
        numberOfChannels: 10,
        sponsor,
        networkConfig,
        config: sponsorConfig,
        rpc,
      });

      try {
        const plugin = createChannelAccountsPlugin({
          channels,
        });

        const pipeline = createClassicTransactionPipeline({
          networkConfig,
          rpc,
        });
        pipeline.use(plugin);

        const parallelResults = await Promise.all(
          Array.from({ length: 10 }, (_, index) =>
            pipeline.run({
              operations: [
                Operation.setOptions({
                  source: actor.address(),
                  homeDomain: `p${index}.cha.test`,
                }),
              ],
              config: actorConfig,
            })),
        );

        assertEquals(parallelResults.length, 10);

        const usedChannelSources = parallelResults.map((result) => {
          assertExists(result);
          assertExists(result.hash);
          assertExists(result.response);

          const transaction = parseSubmittedTransaction(
            result.response.envelopeXdr,
            networkConfig.networkPassphrase,
          );

          return transaction.source;
        });

        assertEquals(
          sortAddresses(usedChannelSources),
          sortAddresses(channels.map((channel) => channel.address())),
        );
        assertEquals(plugin.getChannels().length, 10);

        const followUpResult = await pipeline.run({
          operations: [
            Operation.setOptions({
              source: actor.address(),
              homeDomain: "after.cha.test",
            }),
          ],
          config: actorConfig,
        });

        assertExists(followUpResult);
        assertExists(followUpResult.hash);
        assertExists(followUpResult.response);

        const followUpTransaction = parseSubmittedTransaction(
          followUpResult.response.envelopeXdr,
          networkConfig.networkPassphrase,
        );

        assertEquals(
          channels
            .map((channel) => String(channel.address()))
            .includes(String(followUpTransaction.source)),
          true,
        );
        assertEquals(
          sortAddresses(plugin.getChannels().map((item) => item.address())),
          sortAddresses(channels.map((channel) => channel.address())),
        );
      } finally {
        await closeChannels(channels);
      }
    });
  },
);
