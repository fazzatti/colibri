/**
 * @module ledger-parser/operation/index.unit.test
 * @description Unit tests for Operation class
 *
 * Note: This file uses mock objects that require `any` type casts.
 * The mocks simulate XDR structures that are complex to type fully.
 */

// deno-lint-ignore-file no-explicit-any

import { describe, it, beforeAll } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Ledger } from "@/ledger-parser/ledger/index.ts";
import { Operation } from "@/ledger-parser/operation/index.ts";
import { loadV2Fixtures } from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";
import {
  INVALID_OPERATION_INDEX,
  UNSUPPORTED_OPERATION_TYPE,
} from "@/ledger-parser/error.ts";
import type { rpc } from "stellar-sdk";

describe("Operation", () => {
  let v2Fixtures: rpc.Api.RawLedgerResponse[];
  let ledgerEntry: rpc.Api.RawLedgerResponse;

  beforeAll(() => {
    v2Fixtures = loadV2Fixtures();
    ledgerEntry = v2Fixtures[0];
  });

  describe("From Fixture Data", () => {
    let operation: Operation;

    beforeAll(() => {
      const ledger = Ledger.fromEntry(ledgerEntry);
      const transactions = ledger.transactions;

      if (transactions.length === 0) {
        throw new Error("No transactions in fixture ledger");
      }

      const transaction = transactions[0];
      const operations = transaction.operations;

      if (operations.length === 0) {
        throw new Error("No operations in fixture transaction");
      }

      operation = operations[0];
    });

    it("should have valid index", () => {
      expect(operation.index).toBeGreaterThanOrEqual(0);
    });

    it("should have valid type", () => {
      const type = operation.type;
      expect(type).toBeDefined();
      expect(typeof type).toBe("string");
    });

    it("should have source account", () => {
      const sourceAccount = operation.sourceAccount;
      expect(sourceAccount).toBeDefined();
      expect(
        sourceAccount.startsWith("G") || sourceAccount.startsWith("M")
      ).toBe(true);
    });

    it("should parse operation body based on type", () => {
      const body = operation.body;
      expect(body).toBeDefined();
      expect(typeof body).toBe("object");
    });
  });

  describe("Manual Tests for All Operation Types", () => {
    // Helper to create mock operation with specific type
    function createMockOperation(typeCode: number, bodyFn: () => unknown) {
      return {
        sourceAccount: () => null, // Falls back to transaction source
        body: () => ({
          switch: () => ({ value: typeCode }),
          // Operation-specific body methods
          createAccountOp: bodyFn,
          paymentOp: bodyFn,
          pathPaymentStrictReceiveOp: bodyFn,
          pathPaymentStrictSendOp: bodyFn,
          manageSellOfferOp: bodyFn,
          manageBuyOfferOp: bodyFn,
          createPassiveSellOfferOp: bodyFn,
          setOptionsOp: bodyFn,
          changeTrustOp: bodyFn,
          allowTrustOp: bodyFn,
          destination: bodyFn, // accountMerge uses destination()
          manageDataOp: bodyFn,
          bumpSequenceOp: bodyFn,
          createClaimableBalanceOp: bodyFn,
          claimClaimableBalanceOp: bodyFn,
          beginSponsoringFutureReservesOp: bodyFn,
          revokeSponsorshipOp: bodyFn,
          clawbackOp: bodyFn,
          clawbackClaimableBalanceOp: bodyFn,
          setTrustLineFlagsOp: bodyFn,
          liquidityPoolDepositOp: bodyFn,
          liquidityPoolWithdrawOp: bodyFn,
          invokeHostFunctionOp: bodyFn,
          extendFootprintTtlOp: bodyFn,
          restoreFootprintOp: bodyFn,
        }),
      };
    }

    // Mock transaction for Operation.fromXdr - cast to any for mock
    const mockTransaction = {
      sourceAccount:
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      index: 0,
    } as any;

    it("should handle createPassiveSellOffer (type 4)", () => {
      const mockBody = () => ({
        selling: () => ({
          switch: () => ({ value: 0, name: "assetTypeNative" }),
        }),
        buying: () => ({
          switch: () => ({ value: 0, name: "assetTypeNative" }),
        }),
        amount: () => ({ toString: () => "1000" }),
        price: () => ({ n: () => 1, d: () => 2 }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(4, mockBody) as any,
        0
      );
      expect(op.type).toBe("createPassiveSellOffer");

      const body = op.body;
      expect(body).toBeDefined();
    });

    it("should handle setOptions (type 5)", () => {
      const mockBody = () => ({
        inflationDest: () => null,
        clearFlags: () => 0,
        setFlags: () => 1,
        masterWeight: () => 255,
        lowThreshold: () => 1,
        medThreshold: () => 2,
        highThreshold: () => 3,
        homeDomain: () => null,
        signer: () => null,
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(5, mockBody) as any,
        0
      );
      expect(op.type).toBe("setOptions");

      const body = op.body as any;
      expect(body.masterWeight).toBe(255);
      expect(body.lowThreshold).toBe(1);
    });

    it("should handle setOptions with inflationDest and signer", () => {
      const mockBody = () => ({
        inflationDest: () => ({
          switch: () => ({ value: 0 }),
          ed25519: () => new Uint8Array(32).fill(1),
        }),
        clearFlags: () => 0,
        setFlags: () => 0,
        masterWeight: () => null,
        lowThreshold: () => null,
        medThreshold: () => null,
        highThreshold: () => null,
        homeDomain: () => ({ toString: () => "example.com" }),
        signer: () => ({
          key: () => ({
            value: () =>
              new Uint8Array([115, 105, 103, 110, 101, 114, 107, 101, 121]),
          }),
          weight: () => 1,
        }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(5, mockBody) as any,
        0
      );
      const body = op.body as any;
      expect(body.homeDomain).toBe("example.com");
      expect(body.signer).toBeDefined();
      expect(body.signer.weight).toBe(1);
    });

    it("should handle allowTrust (type 7)", () => {
      const mockBody = () => ({
        trustor: () => ({
          switch: () => ({ value: 0 }),
          ed25519: () => new Uint8Array(32).fill(1),
        }),
        asset: () => ({ switch: () => ({ name: "assetTypeCreditAlphanum4" }) }),
        authorize: () => 1,
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(7, mockBody) as any,
        0
      );
      expect(op.type).toBe("allowTrust");

      const body = op.body as any;
      expect(body.authorize).toBe(1);
    });

    it("should handle accountMerge (type 8)", () => {
      const mockDestination = () => ({
        switch: () => ({ value: 0, name: "keyTypeEd25519" }),
        ed25519: () => new Uint8Array(32).fill(2),
      });

      const mockOp = {
        sourceAccount: () => null,
        body: () => ({
          switch: () => ({ value: 8 }),
          destination: mockDestination,
        }),
      };

      const op = Operation.fromXdr(mockTransaction, mockOp as any, 0);
      expect(op.type).toBe("accountMerge");

      const body = op.body as any;
      expect(body.destination).toBeDefined();
    });

    it("should handle inflation (type 9)", () => {
      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(9, () => ({})) as any,
        0
      );
      expect(op.type).toBe("inflation");

      const body = op.body as any;
      expect(body).toEqual({});
    });

    it("should handle manageData (type 10)", () => {
      const mockBody = () => ({
        dataName: () => ({ toString: () => "myDataEntry" }),
        dataValue: () => new Uint8Array([118, 97, 108, 117, 101]),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(10, mockBody) as any,
        0
      );
      expect(op.type).toBe("manageData");

      const body = op.body as any;
      expect(body.dataName).toBe("myDataEntry");
    });

    it("should handle manageData with null value (delete)", () => {
      const mockBody = () => ({
        dataName: () => ({ toString: () => "deleteThis" }),
        dataValue: () => null,
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(10, mockBody) as any,
        0
      );
      const body = op.body as any;
      expect(body.dataValue).toBeNull();
    });

    it("should handle bumpSequence (type 11)", () => {
      const mockBody = () => ({
        bumpTo: () => ({ toString: () => "123456789" }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(11, mockBody) as any,
        0
      );
      expect(op.type).toBe("bumpSequence");

      const body = op.body as any;
      expect(body.bumpTo).toBe("123456789");
    });

    it("should handle createClaimableBalance (type 14)", () => {
      const mockBody = () => ({
        asset: () => ({
          switch: () => ({ value: 0, name: "assetTypeNative" }),
        }),
        amount: () => ({ toString: () => "5000000000" }),
        claimants: () => [
          {
            v0: () => ({
              destination: () => ({
                switch: () => ({ value: 0 }),
                ed25519: () => new Uint8Array(32).fill(3),
              }),
              predicate: () => ({
                switch: () => ({ name: "claimPredicateUnconditional" }),
              }),
            }),
          },
        ],
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(14, mockBody) as any,
        0
      );
      expect(op.type).toBe("createClaimableBalance");

      const body = op.body as any;
      expect(body.claimants.length).toBe(1);
    });

    it("should handle claimClaimableBalance (type 15)", () => {
      const mockBody = () => ({
        balanceId: () => ({ value: () => ({ toString: () => "abc123" }) }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(15, mockBody) as any,
        0
      );
      expect(op.type).toBe("claimClaimableBalance");

      const body = op.body as any;
      expect(body.balanceId).toBe("abc123");
    });

    it("should handle beginSponsoringFutureReserves (type 16)", () => {
      const mockBody = () => ({
        sponsoredId: () => ({
          switch: () => ({ value: 0 }),
          ed25519: () => new Uint8Array(32).fill(4),
        }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(16, mockBody) as any,
        0
      );
      expect(op.type).toBe("beginSponsoringFutureReserves");

      const body = op.body as any;
      expect(body.sponsoredId).toBeDefined();
    });

    it("should handle endSponsoringFutureReserves (type 17)", () => {
      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(17, () => ({})) as any,
        0
      );
      expect(op.type).toBe("endSponsoringFutureReserves");

      const body = op.body as any;
      expect(body).toEqual({});
    });

    it("should handle revokeSponsorship ledgerEntry (type 18)", () => {
      const mockBody = () => ({
        switch: () => ({ name: "revokeSponsorshipLedgerEntry" }),
        ledgerKey: () => ({ type: "account" }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(18, mockBody) as any,
        0
      );
      expect(op.type).toBe("revokeSponsorship");

      const body = op.body as any;
      expect(body.type).toBe("ledgerEntry");
    });

    it("should handle revokeSponsorship signer (type 18)", () => {
      const mockBody = () => ({
        switch: () => ({ name: "revokeSponsorshipSigner" }),
        signer: () => ({ accountId: "GA..." }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(18, mockBody) as any,
        0
      );
      const body = op.body as any;
      expect(body.type).toBe("signer");
    });

    it("should handle clawback (type 19)", () => {
      const mockBody = () => ({
        asset: () => ({
          switch: () => ({ value: 0, name: "assetTypeNative" }),
        }),
        from: () => ({
          switch: () => ({ value: 0, name: "keyTypeEd25519" }),
          ed25519: () => new Uint8Array(32).fill(5),
        }),
        amount: () => ({ toString: () => "1000000" }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(19, mockBody) as any,
        0
      );
      expect(op.type).toBe("clawback");

      const body = op.body as any;
      expect(body.amount).toBe("1000000");
    });

    it("should handle clawbackClaimableBalance (type 20)", () => {
      const mockBody = () => ({
        balanceId: () => ({
          value: () => ({ toString: () => "claimbalanceid" }),
        }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(20, mockBody) as any,
        0
      );
      expect(op.type).toBe("clawbackClaimableBalance");

      const body = op.body as any;
      expect(body.balanceId).toBe("claimbalanceid");
    });

    it("should handle setTrustLineFlags (type 21)", () => {
      const mockBody = () => ({
        trustor: () => ({
          switch: () => ({ value: 0, name: "keyTypeEd25519" }),
          ed25519: () => new Uint8Array(32),
        }),
        asset: () => ({
          switch: () => ({ value: 0, name: "assetTypeNative" }),
        }),
        clearFlags: () => 1,
        setFlags: () => 2,
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(21, mockBody) as any,
        0
      );
      expect(op.type).toBe("setTrustLineFlags");

      const body = op.body as any;
      expect(body.clearFlags).toBe(1);
      expect(body.setFlags).toBe(2);
    });

    it("should handle liquidityPoolDeposit (type 22)", () => {
      const mockBody = () => ({
        liquidityPoolId: () => new Uint8Array(32).fill(7),
        maxAmountA: () => ({ toString: () => "1000" }),
        maxAmountB: () => ({ toString: () => "2000" }),
        minPrice: () => ({ n: () => 1, d: () => 2 }),
        maxPrice: () => ({ n: () => 3, d: () => 4 }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(22, mockBody) as any,
        0
      );
      expect(op.type).toBe("liquidityPoolDeposit");

      const body = op.body as any;
      expect(body.maxAmountA).toBe("1000");
      expect(body.maxAmountB).toBe("2000");
    });

    it("should handle liquidityPoolWithdraw (type 23)", () => {
      const mockBody = () => ({
        liquidityPoolId: () => new Uint8Array(32).fill(8),
        amount: () => ({ toString: () => "500" }),
        minAmountA: () => ({ toString: () => "100" }),
        minAmountB: () => ({ toString: () => "200" }),
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(23, mockBody) as any,
        0
      );
      expect(op.type).toBe("liquidityPoolWithdraw");

      const body = op.body as any;
      expect(body.amount).toBe("500");
    });

    it("should handle extendFootprintTtl (type 25)", () => {
      const mockBody = () => ({
        extendTo: () => 10000,
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(25, mockBody) as any,
        0
      );
      expect(op.type).toBe("extendFootprintTtl");

      const body = op.body as any;
      expect(body.extendTo).toBe(10000);
    });

    it("should handle restoreFootprint (type 26)", () => {
      const mockBody = () => ({});

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(26, mockBody) as any,
        0
      );
      expect(op.type).toBe("restoreFootprint");

      const body = op.body as any;
      expect(body).toEqual({});
    });

    it("should handle unknown operation type (default case)", () => {
      const mockOp = {
        sourceAccount: () => null,
        body: () => ({
          switch: () => ({ value: 999 }),
        }),
      };

      const op = Operation.fromXdr(mockTransaction, mockOp as any, 0);
      expect(op.type).toBe("unknown_999");

      expect(() => op.body).toThrow(UNSUPPORTED_OPERATION_TYPE);
    });

    it("should use operation source account when available", () => {
      const mockOp = {
        sourceAccount: () => ({
          switch: () => ({ value: 0, name: "keyTypeEd25519" }),
          ed25519: () => new Uint8Array(32).fill(9),
        }),
        body: () => ({
          switch: () => ({ value: 9 }), // inflation
        }),
      };

      const op = Operation.fromXdr(mockTransaction, mockOp as any, 0);
      // Should use operation source, not transaction source
      expect(op.sourceAccount).toBeDefined();
      expect(op.sourceAccount.startsWith("G")).toBe(true);
    });

    it("should expose parentTransaction", () => {
      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(9, () => ({})) as any,
        0
      );
      expect(op.parentTransaction).toBe(mockTransaction);
    });

    it("should serialize to JSON", () => {
      const mockBody = () => ({
        extendTo: () => 10000,
      });

      const op = Operation.fromXdr(
        mockTransaction,
        createMockOperation(25, mockBody) as any,
        5
      );
      const json = op.toJSON();

      expect(json.index).toBe(5);
      expect(json.type).toBe("extendFootprintTtl");
      expect(json.sourceAccount).toBeDefined();
      expect(json.body).toBeDefined();
    });

    it("should throw INVALID_OPERATION_INDEX for negative index", () => {
      expect(() =>
        Operation.fromXdr(
          mockTransaction,
          createMockOperation(0, () => ({})) as any,
          -1
        )
      ).toThrow(INVALID_OPERATION_INDEX);
    });
  });

  describe("Real Fixture Coverage for All Operation Types", () => {
    // These tests use real fixtures to exercise the actual parser methods
    // This ensures 100% coverage of the private parse* methods

    it("should parse createAccount operations from real fixtures", () => {
      for (const entry of v2Fixtures) {
        const ledger = Ledger.fromEntry(entry);
        for (const tx of ledger.transactions) {
          if (!tx.hasEnvelope) continue;
          for (const op of tx.operations) {
            if (op.type === "createAccount") {
              expect(op.body).toBeDefined();
              expect((op.body as any).destination).toBeDefined();
              expect((op.body as any).startingBalance).toBeDefined();
            }
          }
        }
      }
    });

    it("should parse payment operations from real fixtures", () => {
      for (const entry of v2Fixtures) {
        const ledger = Ledger.fromEntry(entry);
        for (const tx of ledger.transactions) {
          if (!tx.hasEnvelope) continue;
          for (const op of tx.operations) {
            if (op.type === "payment") {
              expect(op.body).toBeDefined();
              expect((op.body as any).destination).toBeDefined();
              expect((op.body as any).asset).toBeDefined();
              expect((op.body as any).amount).toBeDefined();
            }
          }
        }
      }
    });

    it("should parse pathPaymentStrictSend operations from real fixtures", () => {
      for (const entry of v2Fixtures) {
        const ledger = Ledger.fromEntry(entry);
        for (const tx of ledger.transactions) {
          if (!tx.hasEnvelope) continue;
          for (const op of tx.operations) {
            if (op.type === "pathPaymentStrictSend") {
              expect(op.body).toBeDefined();
              expect((op.body as any).sendAsset).toBeDefined();
              expect((op.body as any).sendAmount).toBeDefined();
              expect((op.body as any).destination).toBeDefined();
              expect((op.body as any).destAsset).toBeDefined();
              expect((op.body as any).destMin).toBeDefined();
              expect((op.body as any).path).toBeDefined();
            }
          }
        }
      }
    });

    it("should parse manageSellOffer operations from real fixtures", () => {
      for (const entry of v2Fixtures) {
        const ledger = Ledger.fromEntry(entry);
        for (const tx of ledger.transactions) {
          if (!tx.hasEnvelope) continue;
          for (const op of tx.operations) {
            if (op.type === "manageSellOffer") {
              expect(op.body).toBeDefined();
              expect((op.body as any).selling).toBeDefined();
              expect((op.body as any).buying).toBeDefined();
              expect((op.body as any).amount).toBeDefined();
              expect((op.body as any).price).toBeDefined();
              expect((op.body as any).offerId).toBeDefined();
            }
          }
        }
      }
    });

    it("should parse manageBuyOffer operations from real fixtures", () => {
      for (const entry of v2Fixtures) {
        const ledger = Ledger.fromEntry(entry);
        for (const tx of ledger.transactions) {
          if (!tx.hasEnvelope) continue;
          for (const op of tx.operations) {
            if (op.type === "manageBuyOffer") {
              expect(op.body).toBeDefined();
              expect((op.body as any).selling).toBeDefined();
              expect((op.body as any).buying).toBeDefined();
              expect((op.body as any).buyAmount).toBeDefined();
              expect((op.body as any).price).toBeDefined();
              expect((op.body as any).offerId).toBeDefined();
            }
          }
        }
      }
    });

    it("should parse changeTrust operations from real fixtures", () => {
      for (const entry of v2Fixtures) {
        const ledger = Ledger.fromEntry(entry);
        for (const tx of ledger.transactions) {
          if (!tx.hasEnvelope) continue;
          for (const op of tx.operations) {
            if (op.type === "changeTrust") {
              expect(op.body).toBeDefined();
              expect((op.body as any).line).toBeDefined();
              expect((op.body as any).limit).toBeDefined();
            }
          }
        }
      }
    });

    it("should parse invokeHostFunction operations from real fixtures", () => {
      for (const entry of v2Fixtures) {
        const ledger = Ledger.fromEntry(entry);
        for (const tx of ledger.transactions) {
          if (!tx.hasEnvelope) continue;
          for (const op of tx.operations) {
            if (op.type === "invokeHostFunction") {
              expect(op.body).toBeDefined();
              expect((op.body as any).hostFunction).toBeDefined();
              expect((op.body as any).auth).toBeDefined();
            }
          }
        }
      }
    });

    it("should cover all operation types found in fixtures", () => {
      const opTypes = new Set<string>();

      for (const entry of v2Fixtures) {
        const ledger = Ledger.fromEntry(entry);
        for (const tx of ledger.transactions) {
          if (!tx.hasEnvelope) continue;
          for (const op of tx.operations) {
            opTypes.add(op.type);
            // Access body to trigger parsing
            const body = op.body;
            expect(body).toBeDefined();
          }
        }
      }

      // Verify we found the expected operation types
      expect(opTypes.size).toBeGreaterThan(0);
    });
  });
});
