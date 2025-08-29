import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";

import { describe, it, beforeEach } from "@std/testing/bdd";
import {
  Account,
  Operation,
  Asset,
  Memo,
  MemoText,
  Transaction,
  xdr,
} from "stellar-sdk";
import { BuildTransaction } from "./index.ts";
import { TestNet } from "../../network/index.ts";
import type {
  BuildTransactionInput,
  TransactionPreconditions,
} from "./types.ts";
import type { Server } from "stellar-sdk/rpc";
import type { Ed25519PublicKey } from "../../common/types.ts";

import * as E from "./error.ts";

let isGetAccountCalled = false;
const mockSequence = "100";
const mockRpc = {
  getAccount: (address: string) => {
    isGetAccountCalled = true;
    return new Account(address, mockSequence);
  },
} as unknown as Server;

describe("BuildTransaction", () => {
  describe("Construction", () => {
    it("creates process with proper name", () => {
      assertEquals(BuildTransaction.name, "BuildTransaction");
    });

    it("executes with minimal valid input", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
      };

      const tx = await BuildTransaction.run(input);
      assertInstanceOf(tx, Transaction);
    });
  });

  describe("Features", () => {
    describe("Account loading", () => {
      beforeEach(() => {
        isGetAccountCalled = false;
      });

      it("loads account from RPC when no sequence provided", async () => {
        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
        };

        await BuildTransaction.run(input);
        assertEquals(isGetAccountCalled, true);
      });

      it("uses provided sequence without RPC call", async () => {
        const input: BuildTransactionInput = {
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          sequence: "500",
        };

        const tx = await BuildTransaction.run(input);
        assertEquals(isGetAccountCalled, false);

        assertInstanceOf(tx, Transaction);
      });
    });

    describe("Operations", () => {
      it("adds single operation", async () => {
        const operation = Operation.payment({
          destination:
            "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          asset: Asset.native(),
          amount: "100",
        });

        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [operation],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
        };

        const tx = await BuildTransaction.run(input);
        assertInstanceOf(tx, Transaction);
        assertEquals(tx.operations.length, 1);
      });

      it("adds multiple operations", async () => {
        const operations = [
          Operation.payment({
            destination:
              "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
            asset: Asset.native(),
            amount: "50",
          }),
          Operation.payment({
            destination:
              "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
            asset: Asset.native(),
            amount: "25",
          }),
          Operation.createAccount({
            destination:
              "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
            startingBalance: "10",
          }),
        ];

        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations,
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
        };

        const tx = await BuildTransaction.run(input);

        assertEquals(tx.operations.length, 3);
      });
    });

    describe("Preconditions", () => {
      it("sets timeout seconds", async () => {
        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          preconditions: {
            timeoutSeconds: 300,
          },
        };

        const tx = await BuildTransaction.run(input);
        assertInstanceOf(tx, Transaction);
      });

      it("sets time bounds", async () => {
        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          preconditions: {
            timeBounds: {
              minTime: 1000,
              maxTime: 2000,
            },
          },
        };

        const tx = await BuildTransaction.run(input);
        assertInstanceOf(tx, Transaction);
      });

      it("sets ledger bounds", async () => {
        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          preconditions: {
            ledgerBounds: {
              minLedger: 100,
              maxLedger: 200,
            },
          },
        };

        const tx = await BuildTransaction.run(input);
        assertInstanceOf(tx, Transaction);
      });
    });

    describe("Memo", () => {
      it("adds text memo", async () => {
        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          memo: new Memo(MemoText, "test memo"),
        };

        const tx = await BuildTransaction.run(input);

        assertEquals(tx.memo?.type, "text");
      });
    });

    describe("Soroban", () => {
      it("sets soroban data when provided", async () => {
        const sorobanData = xdr.SorobanTransactionData.fromXDR(
          "AAAAAAAAAAEAAAAGAAAAAdeSi3LCcDzP6vfrn/TvTVBKVai5efybRQ6iyEK00c5hAAAAFAAAAAEAAAADAAAAAAAAAAClZfo0zWnOlyv/PMqOyXKqStHsqtWMrbGglMLWqW3QSgAAAAAAAAAA1Tj2cXkwgEDkIjbwQd5c0TGjzOviEzegDNCm43OsOIIAAAAGAAAAAAAAAAClZfo0zWnOlyv/PMqOyXKqStHsqtWMrbGglMLWqW3QSgAAABUVJxzMNVgPHAAAAAAACx/aAAABIAAAAWwAAAAAAANzIQ==",
          "base64"
        );

        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          sorobanData,
        };

        const tx = await BuildTransaction.run(input);
        assertInstanceOf(tx, Transaction);
      });
    });
  });
});
