// deno-lint-ignore-file no-explicit-any
import { assert, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Operation,
  TransactionBuilder,
  type xdr,
  type Transaction,
} from "stellar-sdk";
import { wrapFeeBump } from "@/processes/wrap-fee-bump/index.ts";
import * as E from "@/processes/wrap-fee-bump/error.ts";
import { NetworkConfig } from "@/network/index.ts";
import { isFeeBumpTransaction } from "@/common/type-guards/is-fee-bump-transaction.ts";
import type {
  BaseFee,
  FeeBumpConfig,
} from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

describe("WrapFeeBump", () => {
  const { networkPassphrase } = NetworkConfig.TestNet();

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

  describe("Features", () => {
    it("wraps a Transaction into a FeeBumpTransaction", async () => {
      const transaction = assembleTransaction(alice, [
        Operation.setOptions({}),
      ]);

      const result = await wrapFeeBump({
        transaction,
        config: { source: bob, fee: "101", signers: [] },
        networkPassphrase,
      });

      assert(isFeeBumpTransaction(result));
    });
  });
  describe("Errors", () => {
    it("throws UNEXPECTED_ERROR for unexpected errors", () => {
      const inner = assembleTransaction(alice, [Operation.setOptions({})]);
      const feebump = TransactionBuilder.buildFeeBumpTransaction(
        bob,
        "100",
        inner,
        networkPassphrase
      );

      assertThrows(
        () =>
          wrapFeeBump({
            transaction: feebump as unknown as Transaction, // run expects Transaction | FeeBumpTransaction
            config: null as unknown as FeeBumpConfig,
            networkPassphrase,
          }),
        E.UNEXPECTED_ERROR
      );
    });

    it("throws ALREADY_FEE_BUMP if input is already a FeeBumpTransaction", () => {
      const inner = assembleTransaction(alice, [Operation.setOptions({})]);
      const feebump = TransactionBuilder.buildFeeBumpTransaction(
        bob,
        "100",
        inner,
        networkPassphrase
      );

      assertThrows(
        () =>
          wrapFeeBump({
            transaction: feebump as unknown as Transaction, // run expects Transaction | FeeBumpTransaction
            config: { source: bob, fee: "100", signers: [] },
            networkPassphrase,
          }),
        E.ALREADY_FEE_BUMP
      );
    });
  });

  describe("Errors", () => {
    it("throws NOT_A_TRANSACTION for invalid input", () => {
      assertThrows(
        () =>
          wrapFeeBump({
            transaction: null as unknown as Transaction,
            config: { source: bob, fee: "100", signers: [] },
            networkPassphrase,
          }),
        E.NOT_A_TRANSACTION
      );
    });

    it("throws MISSING_ARG when required args are missing", () => {
      const transaction = assembleTransaction(alice, [
        Operation.setOptions({}),
      ]);

      assertThrows(
        () =>
          wrapFeeBump({
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

      assertThrows(
        () =>
          wrapFeeBump({
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

    it("throws FAILED_TO_BUILD_FEE_BUMP when builder fails", () => {
      const transaction = assembleTransaction(alice, [
        Operation.setOptions({}),
      ]);

      // Monkeypatch to simulate builder failure
      const original = TransactionBuilder.buildFeeBumpTransaction;
      try {
        (TransactionBuilder as any).buildFeeBumpTransaction = () => {
          throw new Error("synthetic failure");
        };

        assertThrows(
          () =>
            wrapFeeBump({
              transaction,
              config: { source: bob, fee: "101", signers: [] },
              networkPassphrase,
            }),
          E.FAILED_TO_BUILD_FEE_BUMP
        );
      } finally {
        (TransactionBuilder as any).buildFeeBumpTransaction = original;
      }
    });

    it("throws FEE_TOO_LOW when the fee for the outer envelope is lower than the inner transaction fee", () => {
      const transaction = assembleTransaction(alice, [
        Operation.setOptions({}),
      ]);

      assertThrows(
        () =>
          wrapFeeBump({
            transaction,
            config: { source: bob, fee: "100", signers: [] },
            networkPassphrase,
          }),
        E.FEE_TOO_LOW
      );
    });
  });
});
