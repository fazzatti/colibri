import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";

import { describe, it } from "@std/testing/bdd";
import {
  Account,
  nativeToScVal,
  Operation,
  SorobanDataBuilder,
  Transaction,
  TransactionBuilder,
  type xdr,
} from "stellar-sdk";
import { AssembleTransaction } from "./index.ts";
import { TestNet } from "../../network/index.ts";
import type { AssembleTransactionInput } from "./types.ts";
import type { Api } from "stellar-sdk/rpc";

import * as E from "./error.ts";

// Helper function to create a test transaction
const createTestTransaction = () => {
  const account = new Account(
    "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
    "100"
  );

  return new TransactionBuilder(account, {
    fee: "100",
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

// Mock RPC responses
const createMockSuccessResponse =
  (): Api.SimulateTransactionSuccessResponse => ({
    id: "mock-id",
    latestLedger: 1000,
    events: [],
    transactionData: new SorobanDataBuilder(),
    minResourceFee: "100",
    result: {
      auth: [],
      retval: nativeToScVal("success", {
        type: "string",
      }),
    },
    _parsed: true,
  });

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
        simulationResponse: createMockSuccessResponse(),
      };

      const result = await AssembleTransaction.run(input);

      assertInstanceOf(result, Transaction);
      assertEquals(
        result.hash().toString("hex"),
        "a2dca24df7c6a6452f761278d511093bf8e65c31ba8469e6095a3e1f17baaaa4"
      );
    });
  });

  describe("Errors", () => {
    it(" throws FAILED_TO_ASSEMBLE_TRANSACTION_ERROR if the assembly fails", async () => {
      const transaction = createTestTransaction();

      const createMockFaultyResponse =
        (): Api.SimulateTransactionSuccessResponse => ({
          id: "mock-id",
          latestLedger: 1000,
          events: [],
          transactionData: "INVALID" as unknown as SorobanDataBuilder,
          minResourceFee: "100",
          result: {
            auth: [],
            retval: "" as unknown as xdr.ScVal,
          },
          _parsed: true,
        });

      const input: AssembleTransactionInput = {
        transaction,
        simulationResponse: createMockFaultyResponse(),
      };

      await assertRejects(
        async () => await AssembleTransaction.run(input),
        E.FAILED_TO_ASSEMBLE_TRANSACTION_ERROR
      );
    });

    it(" throws FAILED_TO_BUILD_TRANSACTION_ERROR if the assembly fails", async () => {
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
              auth: 1 as unknown as xdr.SorobanAuthorizationEntry[],
            })
          )
          .setTimeout(0)
          .build();

        (
          tx as unknown as { _timeBounds: { minTime: string; maxTime: string } }
        )._timeBounds = { minTime: "-10", maxTime: "-1" }; // Corrupt the transaction to cause build failure

        return tx;
      };

      const input: AssembleTransactionInput = {
        transaction: createFaultyTestTransaction(),
        simulationResponse: createMockSuccessResponse(),
      };

      await assertRejects(
        async () => await AssembleTransaction.run(input),
        E.FAILED_TO_BUILD_TRANSACTION_ERROR
      );
    });
  });
});
