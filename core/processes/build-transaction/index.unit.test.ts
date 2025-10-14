import { assertEquals, assertInstanceOf } from "@std/assert";

import { describe, it, beforeEach } from "@std/testing/bdd";
import {
  Account,
  Operation,
  Asset,
  Memo,
  MemoText,
  Transaction,
  xdr,
  Address,
} from "stellar-sdk";
import { P_BuildTransaction } from "./index.ts";
import { TestNet } from "../../network/index.ts";
import type { BuildTransactionInput } from "./types.ts";
import type { Server } from "stellar-sdk/rpc";

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
      assertEquals(P_BuildTransaction().name, "BuildTransaction");
    });

    it("executes with minimal valid input", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
      };

      const tx = await P_BuildTransaction().run(input);
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

        await P_BuildTransaction().run(input);
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

        const tx = await P_BuildTransaction().run(input);
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

        const tx = await P_BuildTransaction().run(input);
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

        const tx = await P_BuildTransaction().run(input);

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

        const tx = await P_BuildTransaction().run(input);
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

        const tx = await P_BuildTransaction().run(input);
        assertInstanceOf(tx, Transaction);
        assertEquals(tx.timeBounds?.minTime, "1000");
        assertEquals(tx.timeBounds?.maxTime, "2000");
      });

      it("sets time bounds with only max", async () => {
        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          preconditions: {
            timeBounds: {
              maxTime: 2000,
            },
          },
        };

        const tx = await P_BuildTransaction().run(input);
        assertInstanceOf(tx, Transaction);
        assertEquals(tx.timeBounds?.minTime, "0");
        assertEquals(tx.timeBounds?.maxTime, "2000");
      });

      it("sets time bounds with only min", async () => {
        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          preconditions: {
            timeBounds: {
              minTime: 1000,
            },
          },
        };

        const tx = await P_BuildTransaction().run(input);
        assertInstanceOf(tx, Transaction);
        assertEquals(tx.timeBounds?.minTime, "1000");
        assertEquals(tx.timeBounds?.maxTime, "0");
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

        const tx = await P_BuildTransaction().run(input);
        assertInstanceOf(tx, Transaction);
        assertEquals(tx.ledgerBounds?.minLedger, 100);
        assertEquals(tx.ledgerBounds?.maxLedger, 200);
      });

      it("sets ledger bounds with only max", async () => {
        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          preconditions: {
            ledgerBounds: {
              maxLedger: 200,
            },
          },
        };

        const tx = await P_BuildTransaction().run(input);
        assertInstanceOf(tx, Transaction);
        assertEquals(tx.ledgerBounds?.minLedger, 0);
        assertEquals(tx.ledgerBounds?.maxLedger, 200);
      });

      it("sets ledger bounds with only min", async () => {
        const input: BuildTransactionInput = {
          rpc: mockRpc,
          operations: [Operation.setOptions({})],
          source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
          baseFee: "100",
          networkPassphrase: TestNet().networkPassphrase,
          preconditions: {
            ledgerBounds: {
              minLedger: 100,
            },
          },
        };

        const tx = await P_BuildTransaction().run(input);
        assertInstanceOf(tx, Transaction);
        assertEquals(tx.ledgerBounds?.minLedger, 100);
        assertEquals(tx.ledgerBounds?.maxLedger, 0);
      });
    });

    it("sets minAccountSequence", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
        preconditions: {
          minAccountSequence: "100",
        },
      };

      const tx = await P_BuildTransaction().run(input);
      assertInstanceOf(tx, Transaction);
      assertEquals(tx.minAccountSequence, "100");
    });

    it("sets minAccountSequenceAge", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
        preconditions: {
          minAccountSequenceAge: 100,
        },
      };

      const tx = await P_BuildTransaction().run(input);
      assertInstanceOf(tx, Transaction);
      assertEquals(tx.minAccountSequenceAge?.toString(), "100");
    });

    it("sets minAccountSequenceLedgerGap", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
        preconditions: {
          minAccountSequenceLedgerGap: 100,
        },
      };

      const tx = await P_BuildTransaction().run(input);
      assertInstanceOf(tx, Transaction);
      assertEquals(tx.minAccountSequenceLedgerGap, 100);
    });

    it("sets extraSigners", async () => {
      const input: BuildTransactionInput = {
        rpc: mockRpc,
        operations: [Operation.setOptions({})],
        source: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        baseFee: "100",
        networkPassphrase: TestNet().networkPassphrase,
        preconditions: {
          extraSigners: [
            "GD5PUITTMNVKWHSLXIWU732MOSEONSMYCXU3A5KS2USRWQONMYO5TTFN",
            "GCYBQHY7TX6FIDSIN4HY5TVNDJ5OQJWSD3SY3LW6BIZ64MZGKQTAWDZ3",
          ],
        },
      };

      const tx = await P_BuildTransaction().run(input);
      assertInstanceOf(tx, Transaction);
      assertEquals(tx.extraSigners, [
        xdr.SignerKey.signerKeyTypeEd25519(
          Address.fromString(
            "GD5PUITTMNVKWHSLXIWU732MOSEONSMYCXU3A5KS2USRWQONMYO5TTFN"
          ).toBuffer()
        ),
        xdr.SignerKey.signerKeyTypeEd25519(
          Address.fromString(
            "GCYBQHY7TX6FIDSIN4HY5TVNDJ5OQJWSD3SY3LW6BIZ64MZGKQTAWDZ3"
          ).toBuffer()
        ),
      ] as unknown);
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

        const tx = await P_BuildTransaction().run(input);

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

        const tx = await P_BuildTransaction().run(input);
        assertInstanceOf(tx, Transaction);
      });
    });
  });
});
