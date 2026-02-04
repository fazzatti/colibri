/**
 * @module ledger-parser/transaction/index.unit.test
 * @description Unit tests for Transaction class
 *
 * Note: This file uses mock objects that require `any` type casts.
 * The mocks simulate XDR structures that are complex to type fully.
 */

// deno-lint-ignore-file no-explicit-any

import { describe, it, beforeAll } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Ledger } from "@/ledger-parser/ledger/index.ts";
import { Transaction } from "@/ledger-parser/transaction/index.ts";
import {
  loadMultiVersionFixtures,
  loadV2Fixtures,
} from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";
import { INVALID_TRANSACTION_INDEX } from "@/ledger-parser/error.ts";
import type { rpc } from "stellar-sdk";

describe("Transaction", () => {
  let v2Fixtures: rpc.Api.RawLedgerResponse[];
  let ledgerEntry: rpc.Api.RawLedgerResponse;

  beforeAll(() => {
    v2Fixtures = loadV2Fixtures();
    ledgerEntry = v2Fixtures[0];
  });

  describe("From Fixture Data", () => {
    let transaction: Transaction;
    let ledger: any;

    beforeAll(() => {
      ledger = Ledger.fromEntry(ledgerEntry);
      const transactions = ledger.transactions;

      if (transactions.length === 0) {
        throw new Error("No transactions in fixture ledger");
      }

      transaction = transactions[0];
    });

    it("should have valid index", () => {
      expect(transaction.index).toBeGreaterThanOrEqual(0);
    });

    it("should expose hasEnvelope property", () => {
      expect(typeof transaction.hasEnvelope).toBe("boolean");
      // v2 ledgers should have envelopes
      expect(transaction.hasEnvelope).toBe(true);
    });

    it("should parse hash", () => {
      const hash = transaction.hash;
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it("should detect successful status", () => {
      const successful = transaction.successful;
      expect(typeof successful).toBe("boolean");
    });

    it("should parse result code", () => {
      const resultCode = transaction.resultCode;
      expect(resultCode).toBeDefined();
      expect(typeof resultCode).toBe("string");
    });

    it("should parse source account", () => {
      const sourceAccount = transaction.sourceAccount;
      expect(sourceAccount).toBeDefined();
      expect(
        sourceAccount.startsWith("G") || sourceAccount.startsWith("M")
      ).toBe(true);
    });

    it("should parse fee", () => {
      const fee = transaction.fee;
      expect(typeof fee).toBe("bigint");
      expect(fee > 0n).toBe(true);
    });

    it("should parse sequence number", () => {
      const sequence = transaction.sequence;
      expect(typeof sequence).toBe("bigint");
      expect(sequence > 0n).toBe(true);
    });

    it("should parse operations array", () => {
      const operations = transaction.operations;
      expect(Array.isArray(operations)).toBe(true);
      expect(operations.length).toBeGreaterThan(0);

      operations.forEach((op) => {
        expect(op.index).toBeGreaterThanOrEqual(0);
      });
    });

    it("should have envelopes for all LedgerCloseMeta versions", () => {
      const multiFixtures = loadMultiVersionFixtures();
      const v0Ledger = Ledger.fromEntry(multiFixtures.lcm_v0);
      const v1Ledger = Ledger.fromEntry(multiFixtures.lcm_v1);
      const v2Ledger = Ledger.fromEntry(multiFixtures.lcm_v2);

      const v0Tx = v0Ledger.transactions[0];
      const v1Tx = v1Ledger.transactions[0];
      const v2Tx = v2Ledger.transactions[0];

      // All versions have envelopes from txSet
      expect(v0Tx.hasEnvelope).toBe(true);
      expect(v1Tx.hasEnvelope).toBe(true);
      expect(v2Tx.hasEnvelope).toBe(true);

      // All should have envelope-dependent properties
      expect(v0Tx.sourceAccount).toBeDefined();
      expect(v1Tx.sourceAccount).toBeDefined();
      expect(v2Tx.sourceAccount).toBeDefined();
    });
  });

  describe("Manual Tests for Envelope Types", () => {
    // Mock ledger for Transaction.fromMeta - cast to any since it's a mock
    const mockLedger = {
      sequence: 12345,
    } as any;

    // Helper to create mock TransactionResultMeta - returns as any for mocking
    function createMockTxResultMeta(): any {
      return {
        txApplyProcessing: () => ({}),
        result: () => ({
          result: () => ({
            result: () => ({
              switch: () => ({ value: 0 }), // txSuccess
            }),
            feeCharged: () => ({ toBigInt: () => 100n }),
          }),
          transactionHash: () => new Uint8Array(32).fill(1),
        }),
      };
    }

    it("should throw for envelope operations when envelope not available", () => {
      const tx = Transaction.fromMeta(mockLedger, createMockTxResultMeta(), 0);

      expect(tx.hasEnvelope).toBe(false);
      expect(() => tx.sourceAccount).toThrow();
      expect(() => tx.sequence).toThrow();
      expect(() => tx.operations).toThrow();
    });

    it("should handle envelopeTypeTxV0 (type 0)", () => {
      const mockEnvelope = {
        switch: () => ({ value: 0 }), // envelopeTypeTxV0
        v0: () => ({
          tx: () => ({
            sourceAccountEd25519: () => new Uint8Array(32).fill(1),
            seqNum: () => ({ toBigInt: () => 123n }),
            operations: () => [
              {
                sourceAccount: () => null,
                body: () => ({ switch: () => ({ value: 9 }) }), // inflation
              },
            ],
          }),
        }),
      };

      const tx = Transaction.fromMetaWithEnvelope(
        mockLedger,
        createMockTxResultMeta(),
        mockEnvelope as any,
        0
      );

      expect(tx.hasEnvelope).toBe(true);
      expect(tx.sourceAccount).toBeDefined();
      expect(tx.sourceAccount.startsWith("G")).toBe(true);
      expect(tx.sequence).toBe(123n);
      expect(tx.operations.length).toBe(1);
    });

    it("should handle envelopeTypeTx (type 2)", () => {
      const mockEnvelope = {
        switch: () => ({ value: 2 }), // envelopeTypeTx
        v1: () => ({
          tx: () => ({
            sourceAccount: () => ({
              switch: () => ({ value: 0, name: "keyTypeEd25519" }),
              ed25519: () => new Uint8Array(32).fill(1),
            }),
            seqNum: () => ({ toBigInt: () => 789n }),
            operations: () => [
              {
                sourceAccount: () => null,
                body: () => ({ switch: () => ({ value: 9 }) }),
              },
            ],
          }),
        }),
      };

      const tx = Transaction.fromMetaWithEnvelope(
        mockLedger,
        createMockTxResultMeta(),
        mockEnvelope as any,
        0
      );

      expect(tx.hasEnvelope).toBe(true);
      expect(tx.sourceAccount).toBeDefined();
      expect(tx.sequence).toBe(789n);
      expect(tx.operations.length).toBe(1);
    });

    it("should handle envelopeTypeTxFeeBump (type 5)", () => {
      const mockEnvelope = {
        switch: () => ({ value: 5 }), // envelopeTypeTxFeeBump
        feeBump: () => ({
          tx: () => ({
            feeSource: () => ({
              switch: () => ({ value: 0, name: "keyTypeEd25519" }),
              ed25519: () => new Uint8Array(32).fill(2),
            }),
            innerTx: () => ({
              v1: () => ({
                tx: () => ({
                  seqNum: () => ({ toBigInt: () => 456n }),
                  sourceAccount: () => ({
                    switch: () => ({ value: 0, name: "keyTypeEd25519" }),
                    ed25519: () => new Uint8Array(32).fill(3),
                  }),
                  operations: () => [
                    {
                      sourceAccount: () => null,
                      body: () => ({ switch: () => ({ value: 9 }) }),
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      };

      const tx = Transaction.fromMetaWithEnvelope(
        mockLedger,
        createMockTxResultMeta(),
        mockEnvelope as any,
        0
      );

      expect(tx.hasEnvelope).toBe(true);
      expect(tx.sourceAccount).toBeDefined();
      expect(tx.sequence).toBe(456n);
      expect(tx.operations.length).toBe(1);
    });

    it("should throw for unsupported envelope type", () => {
      const mockEnvelope = {
        switch: () => ({ value: 99 }), // Unknown type
      };

      const tx = Transaction.fromMetaWithEnvelope(
        mockLedger,
        createMockTxResultMeta(),
        mockEnvelope as any,
        0
      );

      expect(() => tx.sourceAccount).toThrow("Unsupported envelope type: 99");
    });

    it("should handle all result codes", () => {
      const resultCodes = [
        { code: 0, name: "txSuccess" },
        { code: 1, name: "txFailed" },
        { code: 2, name: "txTooEarly" },
        { code: 3, name: "txTooLate" },
        { code: 4, name: "txMissingOperation" },
        { code: 5, name: "txBadSeq" },
        { code: 6, name: "txBadAuth" },
        { code: 7, name: "txInsufficientBalance" },
        { code: 8, name: "txNoAccount" },
        { code: 9, name: "txInsufficientFee" },
        { code: 10, name: "txBadAuthExtra" },
        { code: 11, name: "txInternalError" },
        { code: 12, name: "txNotSupported" },
        { code: 13, name: "txFeeBumpInnerSuccess" },
        { code: 14, name: "txFeeBumpInnerFailed" },
        { code: 15, name: "txNotEnoughSponsoring" },
        { code: 16, name: "txBadSponsorship" },
        { code: 17, name: "txBadMinSeqAgeOrGap" },
        { code: 18, name: "txMalformed" },
        { code: 19, name: "txSorobanInvalid" },
        { code: 99, name: "unknown_99" },
      ];

      for (const { code, name } of resultCodes) {
        const mockMeta = {
          txApplyProcessing: () => ({}),
          result: () => ({
            result: () => ({
              result: () => ({
                switch: () => ({ value: code }),
              }),
              feeCharged: () => ({ toBigInt: () => 100n }),
            }),
            transactionHash: () => new Uint8Array(32).fill(code),
          }),
        } as any;

        const tx = Transaction.fromMeta(mockLedger, mockMeta, 0);
        expect(tx.resultCode).toBe(name);
        expect(tx.successful).toBe(code === 0);
      }
    });

    it("should return 0n for unknown envelope type in sequence getter", () => {
      const mockEnvelope = {
        switch: () => ({ value: 3 }), // Some other type (not 0, 2, or 5)
      };

      const tx = Transaction.fromMetaWithEnvelope(
        mockLedger,
        createMockTxResultMeta(),
        mockEnvelope as any,
        0
      );
      expect(tx.sequence).toBe(0n);
    });

    it("should return empty array for unknown envelope type in operations getter", () => {
      const mockEnvelope = {
        switch: () => ({ value: 3 }), // Some other type (not 0, 2, or 5)
      };

      const tx = Transaction.fromMetaWithEnvelope(
        mockLedger,
        createMockTxResultMeta(),
        mockEnvelope as any,
        0
      );
      expect(tx.operations).toEqual([]);
      expect(tx.operationCount).toBe(0);
    });

    it("should throw INVALID_TRANSACTION_INDEX for negative index", () => {
      expect(() =>
        Transaction.fromMeta(mockLedger, createMockTxResultMeta(), -1)
      ).toThrow(INVALID_TRANSACTION_INDEX);
      expect(() =>
        Transaction.fromMetaWithEnvelope(
          mockLedger,
          createMockTxResultMeta(),
          {} as any,
          -1
        )
      ).toThrow(INVALID_TRANSACTION_INDEX);
    });

    it("should expose parentLedger", () => {
      const tx = Transaction.fromMeta(mockLedger, createMockTxResultMeta(), 0);
      expect(tx.parentLedger).toBe(mockLedger);
    });

    it("should get operation by index", () => {
      const mockEnvelope = {
        switch: () => ({ value: 2 }),
        v1: () => ({
          tx: () => ({
            sourceAccount: () => ({
              switch: () => ({ value: 0, name: "keyTypeEd25519" }),
              ed25519: () => new Uint8Array(32).fill(1),
            }),
            seqNum: () => ({ toBigInt: () => 123n }),
            operations: () => [
              {
                sourceAccount: () => null,
                body: () => ({ switch: () => ({ value: 9 }) }),
              },
              {
                sourceAccount: () => null,
                body: () => ({ switch: () => ({ value: 9 }) }),
              },
            ],
          }),
        }),
      };

      const tx = Transaction.fromMetaWithEnvelope(
        mockLedger,
        createMockTxResultMeta(),
        mockEnvelope as any,
        0
      );

      expect(tx.getOperation(0)).toBeDefined();
      expect(tx.getOperation(1)).toBeDefined();
      expect(tx.getOperation(99)).toBeUndefined();
    });

    it("should serialize to JSON with envelope", () => {
      const mockEnvelope = {
        switch: () => ({ value: 2 }),
        v1: () => ({
          tx: () => ({
            sourceAccount: () => ({
              switch: () => ({ value: 0, name: "keyTypeEd25519" }),
              ed25519: () => new Uint8Array(32).fill(1),
            }),
            seqNum: () => ({ toBigInt: () => 123n }),
            operations: () => [],
          }),
        }),
      };

      const tx = Transaction.fromMetaWithEnvelope(
        mockLedger,
        createMockTxResultMeta(),
        mockEnvelope as any,
        0
      );
      const json = tx.toJSON();

      expect(json.index).toBe(0);
      expect(json.hash).toBeDefined();
      expect(json.successful).toBe(true);
      expect(json.resultCode).toBe("txSuccess");
      expect(json.sourceAccount).toBeDefined();
      expect(json.fee).toBeDefined();
      expect(json.sequence).toBe("123");
      expect(json.operationCount).toBe(0);
    });

    it("should parse fee from result", () => {
      const mockMeta = {
        txApplyProcessing: () => ({}),
        result: () => ({
          result: () => ({
            result: () => ({ switch: () => ({ value: 0 }) }),
            feeCharged: () => ({ toBigInt: () => 500n }),
          }),
          transactionHash: () => new Uint8Array(32).fill(1),
        }),
      } as any;

      const tx = Transaction.fromMeta(mockLedger, mockMeta, 0);
      expect(tx.fee).toBe(500n);
    });
  });
});
