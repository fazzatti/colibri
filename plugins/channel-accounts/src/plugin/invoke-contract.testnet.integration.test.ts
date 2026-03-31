import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals, assertExists } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import {
  createInvokeContractPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  type TransactionConfig,
} from "@colibri/core";
import {
  Asset,
  Operation,
  type Transaction,
  TransactionBuilder,
  type xdr,
} from "stellar-sdk";
import { ChannelAccounts, createChannelAccountsPlugin } from "@/index.ts";

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

describe(
  "[Testnet] InvokeContract channel accounts plugin",
  disableSanitizeConfig,
  () => {
    const networkConfig = NetworkConfig.TestNet();

    const sponsor = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom(),
    );
    const actor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

    const sponsorConfig: TransactionConfig = {
      fee: "10000000",
      timeout: 30,
      source: sponsor.address(),
      signers: [sponsor.signer()],
    };

    const actorConfig: TransactionConfig = {
      fee: "10000000",
      timeout: 30,
      source: actor.address(),
      signers: [actor.signer()],
    };

    beforeAll(async () => {
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        sponsor.address(),
        {
          rpcUrl: networkConfig.rpcUrl,
          allowHttp: networkConfig.allowHttp,
        },
      );
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        actor.address(),
        {
          rpcUrl: networkConfig.rpcUrl,
          allowHttp: networkConfig.allowHttp,
        },
      );
    });

    it("uses a registered channel account when invoking a contract", async () => {
      const [channel] = await ChannelAccounts.open({
        numberOfChannels: 1,
        sponsor,
        networkConfig,
        config: sponsorConfig,
      });

      const plugin = createChannelAccountsPlugin({
        channels: [channel],
      });

      const pipeline = createInvokeContractPipeline({ networkConfig });
      pipeline.use(plugin);

      const xlmContractId = Asset.native().contractId(
        networkConfig.networkPassphrase,
      );

      const result = await pipeline.run({
        operations: [
          Operation.invokeContractFunction({
            contract: xlmContractId,
            function: "decimals",
            args: [],
          }),
        ],
        config: actorConfig,
      });

      assertExists(result);
      assertExists(result.hash);
      assertExists(result.response);
      assertExists(result.returnValue);

      const transaction = parseSubmittedTransaction(
        result.response.envelopeXdr,
        networkConfig.networkPassphrase,
      );

      assertEquals(transaction.source, channel.address());
      assertEquals(plugin.getChannels().map((item) => item.address()), [
        channel.address(),
      ]);
    });
  },
);
