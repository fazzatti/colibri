// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  MuxedAccount,
  Operation,
  SorobanDataBuilder,
  type Transaction,
  TransactionBuilder,
  type xdr,
} from "stellar-sdk";
import { wrapFeeBump } from "@/processes/wrap-fee-bump/index.ts";
import * as E from "@/processes/wrap-fee-bump/error.ts";
import { NetworkConfig } from "@/network/index.ts";
import { isFeeBumpTransaction } from "@/common/type-guards/is-fee-bump-transaction.ts";
import type {
  BaseFee,
  FeeBumpConfig,
} from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey, MuxedAddress } from "@/strkeys/types.ts";

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
    it("matches native fee-bump construction for per-operation bids and Soroban resources", () => {
      for (const operationCount of [1, 2, 3]) {
        const transaction = assembleTransaction(
          alice,
          Array.from(
            { length: operationCount },
            () => Operation.setOptions({}),
          ),
        );
        for (const fee of ["100", "150", "100.0", "1e3"] as const) {
          const actual = wrapFeeBump({
            transaction,
            config: { source: bob, fee, signers: [] },
            networkPassphrase,
          });
          const expected = TransactionBuilder.buildFeeBumpTransaction(
            bob,
            fee,
            transaction,
            networkPassphrase,
          );
          assertEquals(actual.toXdr(), expected.toXdr());
        }
      }
      const transaction = new TransactionBuilder(new Account(alice, "100"), {
        fee: "205",
        networkPassphrase,
      })
        .addOperation(Operation.invokeContractFunction({
          contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
          function: "transfer",
          args: [],
        })).setSorobanData(
          new SorobanDataBuilder().setResourceFee(5000).build(),
        ).setTimeout(0).build();
      assertEquals(transaction.fee, "5205");
      const actual = wrapFeeBump({
        transaction,
        config: { source: bob, fee: "205", signers: [] },
        networkPassphrase,
      });
      assertEquals(actual.fee, "5410");
      assertEquals(
        actual.toXdr(),
        TransactionBuilder.buildFeeBumpTransaction(
          bob,
          "205",
          transaction,
          networkPassphrase,
        ).toXdr(),
      );
      assertThrows(
        () =>
          wrapFeeBump({
            transaction,
            config: { source: bob, fee: "204", signers: [] },
            networkPassphrase,
          }),
        E.FEE_TOO_LOW,
      );
    });
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

    it("preserves a muxed fee source in the fee-bump envelope", () => {
      const transaction = assembleTransaction(alice, [
        Operation.setOptions({}),
      ]);
      const muxedSource = new MuxedAccount(
        new Account(bob, "100"),
        "789",
      ).accountId() as MuxedAddress;

      const result = wrapFeeBump({
        transaction,
        config: { source: muxedSource, fee: "101", signers: [] },
        networkPassphrase,
      });

      assert(isFeeBumpTransaction(result));
      assertEquals(result.feeSource, muxedSource);
    });
  });
  describe("Errors", () => {
    it("throws UNEXPECTED_ERROR for unexpected errors", () => {
      const inner = assembleTransaction(alice, [Operation.setOptions({})]);
      const feebump = TransactionBuilder.buildFeeBumpTransaction(
        bob,
        "100",
        inner,
        networkPassphrase,
      );

      assertThrows(
        () =>
          wrapFeeBump({
            transaction: feebump as unknown as Transaction, // run expects Transaction | FeeBumpTransaction
            config: null as unknown as FeeBumpConfig,
            networkPassphrase,
          }),
        E.UNEXPECTED_ERROR,
      );
    });

    it("throws ALREADY_FEE_BUMP if input is already a FeeBumpTransaction", () => {
      const inner = assembleTransaction(alice, [Operation.setOptions({})]);
      const feebump = TransactionBuilder.buildFeeBumpTransaction(
        bob,
        "100",
        inner,
        networkPassphrase,
      );

      assertThrows(
        () =>
          wrapFeeBump({
            transaction: feebump as unknown as Transaction, // run expects Transaction | FeeBumpTransaction
            config: { source: bob, fee: "100", signers: [] },
            networkPassphrase,
          }),
        E.ALREADY_FEE_BUMP,
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
        E.NOT_A_TRANSACTION,
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
        E.MISSING_ARG,
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
        E.MISSING_ARG,
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
          E.FAILED_TO_BUILD_FEE_BUMP,
        );
      } finally {
        (TransactionBuilder as any).buildFeeBumpTransaction = original;
      }
    });

    it("throws FEE_TOO_LOW when the outer base bid is below the minimum", () => {
      const transaction = assembleTransaction(alice, [
        Operation.setOptions({}),
      ]);

      assertThrows(
        () =>
          wrapFeeBump({
            transaction,
            config: { source: bob, fee: "99", signers: [] },
            networkPassphrase,
          }),
        E.FEE_TOO_LOW,
      );
    });
  });
});
