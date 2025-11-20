import { assertRejects } from "@std/assert";

import { describe, it } from "@std/testing/bdd";
import { Account, Operation, type xdr } from "stellar-sdk";
import { P_BuildTransaction } from "@/processes/build-transaction/index.ts";
import { TestNet } from "@/network/index.ts";
import type {
  BuildTransactionInput,
  TransactionPreconditions,
} from "@/processes/build-transaction/types.ts";
import type { Server } from "stellar-sdk/rpc";
import * as E from "@/processes/build-transaction/error.ts";
import type { BaseFee } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

const mockRpc = {
  getAccount: (address: string) => {
    return new Account(address, "100");
  },
} as unknown as Server;

describe("BuildTransactionErrors", () => {
  it("throws UNEXPECTED_ERROR if an untracked error happens", async () => {
    const faultyInput = null as unknown as BuildTransactionInput;

    await assertRejects(
      async () => await P_BuildTransaction().run(faultyInput),
      E.UNEXPECTED_ERROR
    );
  });

  describe("Invalid base fee", () => {
    it("throws when base fee is NaN", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "not-a-number" as unknown as BaseFee,
        networkPassphrase: TestNet().networkPassphrase,
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.INVALID_BASE_FEE_ERROR
      );
    });

    it("throws when base fee is zero", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "0",
        networkPassphrase: TestNet().networkPassphrase,
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.BASE_FEE_TOO_LOW_ERROR
      );
    });

    it("throws when base fee is negative", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "-100",
        networkPassphrase: TestNet().networkPassphrase,
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.BASE_FEE_TOO_LOW_ERROR
      );
    });
  });

  describe("Account loading failures", () => {
    it("throws when RPC getAccount fails", async () => {
      const mockFailingRpc = {
        getAccount: (_: string) => {
          throw new Error("Network error");
        },
      } as unknown as Server;

      const input: BuildTransactionInput = {
        rpc: mockFailingRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.COULD_NOT_LOAD_ACCOUNT_ERROR
      );
    });

    it("throws when Account constructor fails with invalid sequence", async () => {
      const input: BuildTransactionInput = {
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
        sequence: "invalid-sequence",
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.COULD_NOT_INITIALIZE_ACCOUNT_WITH_SEQUENCE_ERROR
      );
    });
  });

  describe("Precondition conflicts", () => {
    it("throws when both timeBounds and timeoutSeconds are set", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
        preconditions: {
          timeBounds: { minTime: 1000, maxTime: 2000 },
          timeoutSeconds: 300,
        } as unknown as TransactionPreconditions, // Force faulty type
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.CONFLICTING_TIME_CONSTRAINTS_ERROR
      );
    });
  });

  describe("Invalid source account", () => {
    it("throws when source is malformed", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "INVALID_ACCOUNT_ID" as unknown as Ed25519PublicKey, // Force faulty type
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        Error
      );
    });
  });

  describe("No operations provided", () => {
    it("throws when operations array is empty", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.NO_OPERATIONS_PROVIDED_ERROR
      );
    });
  });

  describe("Transaction builder failures", () => {
    it("throws when transaction builder cannot be created", async () => {
      const mockInvalidAccountRpc = {
        getAccount: (_address: string) => {
          return undefined as unknown as Account; // Invalid account
        },
      } as unknown as Server;

      const input: BuildTransactionInput = {
        rpc: mockInvalidAccountRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.COULD_NOT_CREATE_TRANSACTION_BUILDER_ERROR
      );
    });
  });

  describe("Transaction build failures", () => {
    it("throws when transaction cannot be built", async () => {
      const mockFaultyOp = null as unknown as xdr.Operation; // Invalid operation
      const input: BuildTransactionInput = {
        operations: [mockFaultyOp],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        sequence: "100",
        baseFee: "100",
        networkPassphrase: "mock",
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.COULD_NOT_BUILD_TRANSACTION_ERROR
      );
    });
  });

  describe("Precondition setting failures", () => {
    it("throws when preconditions cannot be set", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
        preconditions: {
          timeBounds: { minTime: -1, maxTime: -2 }, // Invalid time bounds
        } as unknown as TransactionPreconditions,
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.FAILED_TO_SET_PRECONDITIONS_ERROR
      );
    });
  });

  describe("Soroban data failures", () => {
    it("throws when Soroban data cannot be set", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
        sorobanData:
          "invalid-soroban-data" as unknown as xdr.SorobanTransactionData,
      };

      await assertRejects(
        async () => await P_BuildTransaction().run(input),
        E.COULD_NOT_SET_SOROBAN_DATA_ERROR
      );
    });
  });
});
