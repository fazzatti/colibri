import { assertEquals, assertRejects } from "@std/assert";

import { describe, it } from "@std/testing/bdd";
import {
  Account,
  nativeToScVal,
  Operation,
  SorobanDataBuilder,
  type Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import { P_SimulateTransaction } from "./index.ts";
import { TestNet } from "../../network/index.ts";
import type { SimulateTransactionInput } from "./types.ts";
import type { Server, Api } from "stellar-sdk/rpc";
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
    .addOperation(Operation.setOptions({}))
    .setTimeout(300)
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

const createMockRestoreResponse =
  (): Api.SimulateTransactionRestoreResponse => ({
    id: "mock-id",
    latestLedger: 1000,
    events: [],
    transactionData: new SorobanDataBuilder(),
    minResourceFee: "100",
    result: {
      auth: [],
      retval: nativeToScVal("restore", {
        type: "string",
      }),
    },
    restorePreamble: {
      transactionData: new SorobanDataBuilder(),
      minResourceFee: "200",
    },
    _parsed: true,
  });

const createMockErrorResponse = (): Api.SimulateTransactionErrorResponse => ({
  id: "mock-id",
  latestLedger: 1000,
  events: [],
  error: "Mock simulation error",
  _parsed: true,
});

describe("SimulateTransaction", () => {
  describe("Construction", () => {
    it("creates process with proper name", () => {
      assertEquals(P_SimulateTransaction().name, "SimulateTransaction");
    });

    it("executes with minimal valid input", async () => {
      const transaction = createTestTransaction();
      const mockRpc = {
        simulateTransaction: (_: Transaction) => createMockSuccessResponse(),
      } as unknown as Server;

      const input: SimulateTransactionInput = {
        transaction,
        rpc: mockRpc,
      };

      const result = await P_SimulateTransaction().run(input);
      assertEquals(result.id, "mock-id");
    });
  });

  describe("Features", () => {
    describe("Success responses", () => {
      it("returns success response for successful simulation", async () => {
        const transaction = createTestTransaction();
        const mockRpc = {
          simulateTransaction: (_: Transaction) => createMockSuccessResponse(),
        } as unknown as Server;

        const input: SimulateTransactionInput = {
          transaction,
          rpc: mockRpc,
        };

        const result = await P_SimulateTransaction().run(input);
        assertEquals(result.minResourceFee, "100");
      });

      it("returns restore response for restoration needed", async () => {
        const transaction = createTestTransaction();
        const mockRpc = {
          simulateTransaction: (_: Transaction) => createMockRestoreResponse(),
        } as unknown as Server;

        const input: SimulateTransactionInput = {
          transaction,
          rpc: mockRpc,
        };

        const result = await P_SimulateTransaction().run(input);
        assertEquals(result.minResourceFee, "100");
        assertEquals(
          (result as Api.SimulateTransactionRestoreResponse).restorePreamble
            .minResourceFee,
          "200"
        );
      });
    });
  });

  describe("Errors", () => {
    describe("RPC simulation failures", () => {
      it("throws COULD_NOT_SIMULATE_TRANSACTION when RPC call fails", async () => {
        const transaction = createTestTransaction();
        const mockRpc = {
          simulateTransaction: (_: Transaction) => {
            throw new Error("Network error");
          },
        } as unknown as Server;

        const input: SimulateTransactionInput = {
          transaction,
          rpc: mockRpc,
        };

        await assertRejects(
          async () => await P_SimulateTransaction().run(input),
          E.COULD_NOT_SIMULATE_TRANSACTION
        );
      });
    });

    describe("Simulation failures", () => {
      it("throws SIMULATION_FAILED when simulation returns error", async () => {
        const transaction = createTestTransaction();
        const mockRpc = {
          simulateTransaction: (_: Transaction) => createMockErrorResponse(),
        } as unknown as Server;

        const input: SimulateTransactionInput = {
          transaction,
          rpc: mockRpc,
        };

        await assertRejects(
          async () => await P_SimulateTransaction().run(input),
          E.SIMULATION_FAILED
        );
      });
    });

    describe("Verification failures", () => {
      it("throws SIMULATION_RESULT_NOT_VERIFIED when result cannot be verified", async () => {
        const transaction = createTestTransaction();
        const mockRpc = {
          simulateTransaction: (_: Transaction) =>
            ({
              id: "mock-id",
              latestLedger: 1000,
              // Invalid response that doesn't match any expected type
            } as unknown as Api.SimulateTransactionResponse),
        } as unknown as Server;

        const input: SimulateTransactionInput = {
          transaction,
          rpc: mockRpc,
        };

        await assertRejects(
          async () => await P_SimulateTransaction().run(input),
          E.SIMULATION_RESULT_NOT_VERIFIED
        );
      });
    });

    describe("Unexpected errors", () => {
      it("throws UNEXPECTED_ERROR for unknown error types", async () => {
        const transaction = createTestTransaction();
        const mockRpc = {
          simulateTransaction: (_: Transaction) => {
            // Simulate an unexpected error that's not a SimulateTransactionError
            return undefined; // mock an undefined object to break unexpectedly
          },
        } as unknown as Server;

        const input: SimulateTransactionInput = {
          transaction,
          rpc: mockRpc,
        };

        await assertRejects(
          async () => await P_SimulateTransaction().run(input),
          E.UNEXPECTED_ERROR
        );
      });
    });
  });
});
