import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  type FeeBumpTransaction,
  Keypair,
  Networks,
  Operation,
  type Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import {
  getTransactionTimeout,
  getOperationsFromTransaction,
  getOperationType,
  getOperationTypesFromTransaction,
} from "./transaction.ts";

describe("Transaction Helpers", () => {
  const sourceKp = Keypair.random();
  const account = new Account(sourceKp.publicKey(), "0");

  describe("getTransactionTimeout", () => {
    it("should get timeout in seconds", () => {
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

      const timeout = getTransactionTimeout(tx, "seconds");
      assertExists(timeout);
      assert(typeof timeout === "number");
    });

    it("should get timeout in milliseconds", () => {
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

      const timeout = getTransactionTimeout(tx, "milliseconds");
      assertExists(timeout);
      assert(typeof timeout === "number");
    });

    it("should return undefined for transaction without timeout", () => {
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
        .setTimeout(0)
        .build();

      const timeout = getTransactionTimeout(tx);
      assertEquals(timeout, undefined);
    });

    it("should handle fee bump transaction and extract inner transaction timeout", () => {
      const innerTx = new TransactionBuilder(account, {
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

      const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        sourceKp,
        "200",
        innerTx,
        Networks.TESTNET
      );

      const timeout = getTransactionTimeout(feeBumpTx);
      assertExists(timeout);
      assert(typeof timeout === "number");
    });

    it("should throw error for invalid transaction type", () => {
      const invalidTx = {} as unknown as Transaction | FeeBumpTransaction;

      assertThrows(() => getTransactionTimeout(invalidTx));
    });
  });

  describe("getOperationsFromTransaction", () => {
    it("should extract operations from transaction", () => {
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

      const ops = getOperationsFromTransaction(tx);

      assertExists(ops);
      assert(Array.isArray(ops));
      assertEquals(ops.length, 1);
    });

    it("should extract multiple operations", () => {
      const tx = new TransactionBuilder(account, {
        fee: "200",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "10",
          })
        )
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "5",
          })
        )
        .setTimeout(30)
        .build();

      const ops = getOperationsFromTransaction(tx);

      assertEquals(ops.length, 2);
    });

    it("should throw error for invalid transaction", () => {
      const invalidTx = {} as unknown as Transaction;

      assertThrows(() => getOperationsFromTransaction(invalidTx));
    });
  });

  describe("getOperationType", () => {
    it("should get operation type name", () => {
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

      const ops = getOperationsFromTransaction(tx);
      const type = getOperationType(ops[0]);

      assertEquals(type, "payment");
    });
  });

  describe("getOperationTypesFromTransaction", () => {
    it("should get all operation types from transaction", () => {
      const tx = new TransactionBuilder(account, {
        fee: "200",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "10",
          })
        )
        .addOperation(Operation.setOptions({}))
        .setTimeout(30)
        .build();

      const types = getOperationTypesFromTransaction(tx);

      assertEquals(types.length, 2);
      assertEquals(types[0], "payment");
      assertEquals(types[1], "setOptions");
    });
  });
});
