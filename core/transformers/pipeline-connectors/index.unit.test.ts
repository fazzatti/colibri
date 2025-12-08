import { assert, assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import { buildToSimulate } from "@/transformers/pipeline-connectors/build-to-simulate.ts";
import { buildToEnvelopeSigningRequirements } from "@/transformers/pipeline-connectors/build-to-envelope-signing-req.ts";
import { assembleToEnvelopeSigningRequirements } from "@/transformers/pipeline-connectors/assemble-to-envelope-signing-req.ts";
import { isTransaction } from "@/common/type-guards/is-transaction.ts";

describe("pipeline-connectors", () => {
  const sourceKp = Keypair.random();
  const account = new Account(sourceKp.publicKey(), "0");

  describe("buildToEnvelopeSigningRequirements", () => {
    it("converts built transaction to envelope signing requirements", async () => {
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "10",
          })
        )
        .setTimeout(30)
        .build();

      const result = await buildToEnvelopeSigningRequirements(tx);

      assertExists(result);
      assertExists(result.transaction);
      assert(isTransaction(result.transaction));
    });
  });

  describe("assembleToEnvelopeSigningRequirements", () => {
    it("converts assembled transaction to envelope signing requirements", async () => {
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "10",
          })
        )
        .setTimeout(30)
        .build();

      const result = await assembleToEnvelopeSigningRequirements(tx);

      assertExists(result);
      assertExists(result.transaction);
      assert(isTransaction(result.transaction));
    });
  });

  describe("buildToSimulate", () => {
    it("converts built transaction to simulate request", async () => {
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "10",
          })
        )
        .setTimeout(30)
        .build();

      const mockRpc = {} as unknown as Server;

      const connectorBuildToSimulate = buildToSimulate(mockRpc);

      assertEquals(typeof connectorBuildToSimulate, "function");

      const result = await connectorBuildToSimulate(tx);

      assertExists(result);
      assertExists(result.transaction);
      assert(isTransaction(result.transaction));
      assertEquals(result.rpc, mockRpc);
    });
  });
});
