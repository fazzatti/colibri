// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Operation,
  TransactionBuilder,
  type xdr,
  type Transaction,
} from "stellar-sdk";

import { WrapFeeBump } from "./index.ts";
import * as E from "./error.ts";
import { TestNet } from "../../network/index.ts";
import { isFeeBumpTransaction } from "../../common/verifiers/is-fee-bump-transaction.ts";
import type {
  BaseFee,
  FeeBumpConfig,
} from "../../common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "../../strkeys/types.ts";

describe("WrapFeeBump", () => {
  const { networkPassphrase } = TestNet();

  const assembleTransaction = (source: string, ops: xdr.Operation[]) => {
    const sourceAcc = new Account(source, "100");
    const txb = new TransactionBuilder(sourceAcc, {
      fee: "100",
      networkPassphrase,
    });
    for (const op of ops) txb.addOperation(op);
    txb.setTimeout(0);
    return txb.build();
  };

  const alice = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";
  const bob = "GDMZZQ62ZEO4B7YMBHPJ3LHCLIYOG7JE4XCHEGHV4MINCN6O3WFA4MVQ";

  describe("Construction", () => {
    it("creates process with proper name", () => {
      // This will fail until you change the name in index.ts to "WrapFeeBump"
      assertEquals(WrapFeeBump.name, "WrapFeeBump");
    });
  });

  describe("Features", () => {
    it("wraps a Transaction into a FeeBumpTransaction", async () => {
      const transaction = assembleTransaction(alice, [
        Operation.setOptions({}),
      ]);

      const result = await WrapFeeBump.run({
        transaction,
        config: { source: bob, fee: "100", signers: [] },
        networkPassphrase,
      });

      assert(isFeeBumpTransaction(result));
    });
  });
  describe("Errors", () => {
    it("throws UNEXPECTED_ERROR for unexpected errors", async () => {
      const inner = assembleTransaction(alice, [Operation.setOptions({})]);
      const feebump = TransactionBuilder.buildFeeBumpTransaction(
        bob,
        "100",
        inner,
        networkPassphrase
      );

      await assertRejects(
        () =>
          WrapFeeBump.run({
            transaction: feebump as unknown as Transaction, // run expects Transaction | FeeBumpTransaction
            config: null as unknown as FeeBumpConfig,
            networkPassphrase,
          }),
        E.UNEXPECTED_ERROR
      );
    });

    it("throws ALREADY_FEE_BUMP if input is already a FeeBumpTransaction", async () => {
      const inner = assembleTransaction(alice, [Operation.setOptions({})]);
      const feebump = TransactionBuilder.buildFeeBumpTransaction(
        bob,
        "100",
        inner,
        networkPassphrase
      );

      await assertRejects(
        () =>
          WrapFeeBump.run({
            transaction: feebump as unknown as Transaction, // run expects Transaction | FeeBumpTransaction
            config: { source: bob, fee: "100", signers: [] },
            networkPassphrase,
          }),
        E.ALREADY_FEE_BUMP
      );
    });
  });

  describe("Errors", () => {
    it("throws NOT_A_TRANSACTION for invalid input", async () => {
      await assertRejects(
        () =>
          WrapFeeBump.run({
            transaction: null as unknown as Transaction,
            config: { source: bob, fee: "100", signers: [] },
            networkPassphrase,
          }),
        E.NOT_A_TRANSACTION
      );
    });

    it("throws MISSING_ARG when required args are missing", async () => {
      const transaction = assembleTransaction(alice, [
        Operation.setOptions({}),
      ]);

      await assertRejects(
        () =>
          WrapFeeBump.run({
            transaction,
            // missing fee
            config: {
              source: bob,
              fee: undefined as unknown as BaseFee,
              signers: [],
            },
            networkPassphrase,
          }),
        E.MISSING_ARG
      );

      await assertRejects(
        () =>
          WrapFeeBump.run({
            transaction,
            // missing source
            config: {
              source: undefined as unknown as Ed25519PublicKey,
              fee: "100",
              signers: [],
            },
            networkPassphrase,
          }),
        E.MISSING_ARG
      );
    });

    it("throws FAILED_TO_BUILD_FEE_BUMP when builder fails", async () => {
      const transaction = assembleTransaction(alice, [
        Operation.setOptions({}),
      ]);

      // Monkeypatch to simulate builder failure
      const original = TransactionBuilder.buildFeeBumpTransaction;
      try {
        (TransactionBuilder as any).buildFeeBumpTransaction = () => {
          throw new Error("synthetic failure");
        };

        await assertRejects(
          () =>
            WrapFeeBump.run({
              transaction,
              config: { source: bob, fee: "100", signers: [] },
              networkPassphrase,
            }),
          E.FAILED_TO_BUILD_FEE_BUMP
        );
      } finally {
        (TransactionBuilder as any).buildFeeBumpTransaction = original;
      }
    });
  });
});
