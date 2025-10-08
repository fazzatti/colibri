// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";

import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  Operation,
  SorobanDataBuilder,
  Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import { AssembleTransaction } from "./index.ts";
import { TestNet } from "../../network/index.ts";
import type { AssembleTransactionInput } from "./types.ts";

import * as E from "./error.ts";
import { stub } from "@std/testing/mock";
import { BaseFee } from "../../common/types/transaction-config/types.ts";
import { text } from "node:stream/consumers";

// Helper function to create a test transaction
const createTestTransaction = (fee: BaseFee = "100") => {
  const account = new Account(
    "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
    "100"
  );

  return new TransactionBuilder(account, {
    fee: fee,
    networkPassphrase: TestNet().networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        function: "transfer",
        args: [],
      })
    )
    .setTimeout(0)
    .build();
};

describe("AssembleTransaction", () => {
  describe("Construction", () => {
    it("creates process with proper name", () => {
      assertEquals(AssembleTransaction.name, "AssembleTransaction");
    });
  });

  describe("Features", () => {
    it("executes with minimal valid input", async () => {
      const transaction = createTestTransaction();

      const input: AssembleTransactionInput = {
        transaction,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
        resourceFee: 0,
      };

      const result = await AssembleTransaction.run(input);

      assertInstanceOf(result, Transaction);
    });

    it("executes with resourceFee and add it to the total fee", async () => {
      const inclusionFee = "10";
      const transaction = createTestTransaction(inclusionFee);
      const sorobanData = new SorobanDataBuilder();
      sorobanData.setResourceFee(1);

      const input: AssembleTransactionInput = {
        transaction,
        sorobanData,
        authEntries: [],
        resourceFee: 5,
      };

      const result = await AssembleTransaction.run(input);
      assertInstanceOf(result, Transaction);
      assertEquals(result.fee, "15");
    });

    it("executes with soroban data and auth entries", async () => {
      const transaction = createTestTransaction();
      const sorobanData = new SorobanDataBuilder();
      sorobanData.setResourceFee(1);

      const input: AssembleTransactionInput = {
        transaction,
        sorobanData,
        authEntries: [],
        resourceFee: 0,
      };

      const result = await AssembleTransaction.run(input);
      assertInstanceOf(result, Transaction);
    });
  });

  describe("Errors", () => {
    it("throws UNEXPECTED_ERROR if an untracked error happens", async () => {
      const faultyInput = null as unknown as AssembleTransactionInput;

      await assertRejects(
        async () => await AssembleTransaction.run(faultyInput),
        E.UNEXPECTED_ERROR
      );
    });

    it("throws NOT_SMART_CONTRACT_TRANSACTION_ERROR for non-smart contract transaction", async () => {
      const account = new Account(
        "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        "100"
      );

      const nonSmartContractTx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: TestNet().networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination:
              "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
            asset: Asset.native(),
            amount: "100",
          })
        )
        .setTimeout(0)
        .build();

      const input: AssembleTransactionInput = {
        transaction: nonSmartContractTx,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
        resourceFee: 0,
      };

      await assertRejects(
        async () => await AssembleTransaction.run(input),
        E.NOT_SMART_CONTRACT_TRANSACTION_ERROR
      );
    });

    it("throws FAILED_TO_BUILD_SOROBAN_DATA_ERROR if soroban data build fails", async () => {
      const transaction = createTestTransaction();

      const corruptedSorobanData = "INVALID" as unknown as SorobanDataBuilder;

      const input: AssembleTransactionInput = {
        transaction,
        sorobanData: corruptedSorobanData,
        authEntries: [],
        resourceFee: 0,
      };

      await assertRejects(
        async () => await AssembleTransaction.run(input),
        E.FAILED_TO_BUILD_SOROBAN_DATA_ERROR
      );
    });

    it("throws FAILED_TO_ASSEMBLE_TRANSACTION_ERROR if the assembly fails", async () => {
      const transaction = createTestTransaction();
      // Stub the TransactionBuilder prototype's addOperation method
      const addOperationStub = stub(
        TransactionBuilder.prototype,
        "addOperation",
        () => {
          throw new Error("Mocked addOperation error");
        }
      );

      const input: AssembleTransactionInput = {
        transaction: transaction,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
        resourceFee: 0,
      };

      await assertRejects(
        async () => await AssembleTransaction.run(input),
        E.FAILED_TO_ASSEMBLE_TRANSACTION_ERROR
      );

      addOperationStub.restore();
    });

    it("throws FAILED_TO_BUILD_TRANSACTION_ERROR if the transaction build fails", async () => {
      const createFaultyTestTransaction = () => {
        const account = new Account(
          "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          "100"
        );

        const tx = new TransactionBuilder(account, {
          fee: "100",
          networkPassphrase: TestNet().networkPassphrase,
        })
          .addOperation(
            Operation.invokeContractFunction({
              contract:
                "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
              function: "transfer",
              args: [],
            })
          )
          .setTimeout(0)
          .build();

        // Corrupt the transaction to cause build failure
        (tx as any)._timeBounds = { minTime: "-10", maxTime: "-1" };

        return tx;
      };

      const input: AssembleTransactionInput = {
        transaction: createFaultyTestTransaction(),
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
        resourceFee: 0,
      };

      await assertRejects(
        async () => await AssembleTransaction.run(input),
        E.FAILED_TO_BUILD_TRANSACTION_ERROR
      );
    });

    it("throws MISSING_ARG if the transaction input lacks a required arg", async () => {
      const tx = undefined as unknown as Transaction;

      const input: AssembleTransactionInput = {
        transaction: tx,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
        resourceFee: 0,
      };

      await assertRejects(
        async () => await AssembleTransaction.run(input),
        E.MISSING_ARG
      );
    });
  });
});
