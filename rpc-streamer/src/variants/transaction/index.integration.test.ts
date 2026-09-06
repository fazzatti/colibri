import { assert, assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Asset, Operation } from "stellar-sdk";
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { StellarTestLedger } from "@colibri/test-tooling";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { RPCStreamer } from "@/streamer.ts";
import type { StreamedTransaction } from "@/variants/transaction/types.ts";
import type { StreamedOperation } from "@/variants/operation/types.ts";

describe(
  "[Quickstart] confirmed transaction and operation streams",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName: "colibri-transaction-operation-streams",
      containerImageVersion: "testing",
      logLevel: "silent",
    });
    const sender = LocalSigner.generateRandom();
    const recipient = LocalSigner.generateRandom();
    let networkConfig: NetworkConfig;
    const transactions: { hash: string; ledger: number }[] = [];

    beforeAll(async () => {
      await ledger.start();
      const details = await ledger.getNetworkDetails();
      networkConfig = NetworkConfig.CustomNet(details);
      for (const signer of [sender, recipient]) {
        await initializeWithFriendbot(
          details.friendbotUrl,
          signer.publicKey(),
          {
            rpcUrl: details.rpcUrl,
            allowHttp: true,
          },
        );
      }
      const execute = createClassicTransactionPipeline({ networkConfig });
      for (let i = 0; i < 2; i++) {
        const result = await execute({
          operations: Array.from({ length: 3 }, () =>
            Operation.payment({
              destination: recipient.publicKey(),
              asset: Asset.native(),
              amount: "0.1234567",
            })),
          config: {
            source: sender.publicKey(),
            signers: [sender],
            fee: "100",
            timeout: 60,
          },
        });
        transactions.push({
          hash: result.response.txHash,
          ledger: result.response.ledger,
        });
      }
    });
    afterAll(async () => {
      sender.destroy();
      recipient.destroy();
      await ledger.destroy();
    });

    it("delivers confirmed native transactions and operation decimal values from actual ledger XDR", async () => {
      const transactionStream = RPCStreamer.transaction({
        networkConfig,
        options: { pagingIntervalMs: 0, waitLedgerIntervalMs: 0 },
      });
      const receivedTransactions: StreamedTransaction[] = [];
      const bounds = {
        startLedger: transactions[0].ledger,
        stopLedger: transactions[1].ledger,
      };
      await transactionStream.startLive((item) => {
        receivedTransactions.push(item);
      }, bounds);
      const expected = new Set(transactions.map((item) => item.hash));
      assertEquals(
        receivedTransactions.filter((item) =>
          expected.has(item.transactionHash)
        ).length,
        2,
      );

      const operationStream = RPCStreamer.operation({
        networkConfig,
        options: { pagingIntervalMs: 0, waitLedgerIntervalMs: 0 },
      });
      const operations: StreamedOperation[] = [];
      await operationStream.start((item) => {
        if (expected.has(item.transactionHash)) operations.push(item);
      }, bounds);
      assertEquals(operations.length, 6);
      for (const item of operations) {
        assertEquals(item.transactionStatus, "success");
        assert(item.operation.type === "payment");
        assertEquals(item.operation.amount, "0.1234567");
        assertEquals(item.operation.destination, recipient.publicKey());
        assertEquals(item.operation.asset.isNative(), true);
      }
      assertEquals(operations.map((item) => item.operationIndex), [
        0,
        1,
        2,
        0,
        1,
        2,
      ]);
    });

    it("replays a real partially consumed ledger when cancelled inside its transaction", async () => {
      const stream = RPCStreamer.operation({
        networkConfig,
        options: { pagingIntervalMs: 0, waitLedgerIntervalMs: 0 },
      });
      const selected = transactions[0];
      const checkpoints: number[] = [];
      const partial: StreamedOperation[] = [];
      await stream.startLive((item) => {
        if (item.transactionHash === selected.hash) {
          partial.push(item);
          stream.stop();
        }
      }, {
        startLedger: selected.ledger,
        stopLedger: selected.ledger,
        checkpointInterval: 1,
        onCheckpoint: (sequence) => {
          checkpoints.push(sequence);
        },
      });
      assertEquals(partial.length, 1);
      assertEquals(stream.nextLedger, selected.ledger);
      assertEquals(checkpoints, []);
      const resumed: StreamedOperation[] = [];
      await stream.startLive((item) => {
        if (item.transactionHash === selected.hash) resumed.push(item);
      }, {
        startLedger: stream.nextLedger,
        stopLedger: selected.ledger,
        checkpointInterval: 1,
        onCheckpoint: (sequence) => {
          checkpoints.push(sequence);
        },
      });
      assertEquals(resumed.map((item) => item.operationIndex), [0, 1, 2]);
      assertEquals(checkpoints, [selected.ledger]);
    });
  },
);
