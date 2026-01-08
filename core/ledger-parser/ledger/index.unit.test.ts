/**
 * @module ledger-parser/ledger/index.unit.test
 * @description Unit tests for Ledger class
 */

import { describe, it, beforeAll } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Ledger } from "@/ledger-parser/ledger/index.ts";
import {
  loadLedgerFixtures,
  loadMultiVersionFixtures,
  loadV2Fixtures,
} from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";
import {
  INVALID_LEDGER_ENTRY,
  INVALID_HEADER_XDR,
  INVALID_METADATA_XDR,
  UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
} from "@/ledger-parser/error.ts";
import type { rpc } from "stellar-sdk";

describe("Ledger", () => {
  let fixtures: rpc.Api.RawLedgerResponse[];
  let v2Fixtures: rpc.Api.RawLedgerResponse[];
  let ledgerEntry: rpc.Api.RawLedgerResponse;

  beforeAll(() => {
    fixtures = loadLedgerFixtures();
    v2Fixtures = loadV2Fixtures();
    ledgerEntry = v2Fixtures[0];
  });

  describe("Factory & Validation", () => {
    it("should create a Ledger from valid entry", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);

      expect(ledger.sequence).toBe(ledgerEntry.sequence);
      expect(ledger.hash).toBe(ledgerEntry.hash);
      expect(ledgerEntry.ledgerCloseTime).toBeDefined();
    });

    it("should throw INVALID_LEDGER_ENTRY for missing sequence", () => {
      const invalidEntry = { ...ledgerEntry, sequence: 0 };

      // deno-lint-ignore no-explicit-any
      expect(() => Ledger.fromEntry(invalidEntry as any)).toThrow(
        INVALID_LEDGER_ENTRY
      );
    });

    it("should throw INVALID_LEDGER_ENTRY for missing hash", () => {
      const invalidEntry = { ...ledgerEntry, hash: "" };

      // deno-lint-ignore no-explicit-any
      expect(() => Ledger.fromEntry(invalidEntry as any)).toThrow(
        INVALID_LEDGER_ENTRY
      );
    });

    it("should throw INVALID_LEDGER_ENTRY for missing ledgerCloseTime", () => {
      const invalidEntry = { ...ledgerEntry, ledgerCloseTime: "" };

      // deno-lint-ignore no-explicit-any
      expect(() => Ledger.fromEntry(invalidEntry as any)).toThrow(
        INVALID_LEDGER_ENTRY
      );
    });
  });

  describe("XDR Parsing", () => {
    it("should throw INVALID_HEADER_XDR for corrupted header", () => {
      const invalidEntry = { ...ledgerEntry, headerXdr: "invalid-base64-xdr" };
      const ledger = Ledger.fromEntry(invalidEntry);

      expect(() => ledger.header).toThrow(INVALID_HEADER_XDR);
    });

    it("should throw INVALID_METADATA_XDR for corrupted metadata", () => {
      const invalidEntry = {
        ...ledgerEntry,
        metadataXdr: "invalid-base64-xdr",
      };
      const ledger = Ledger.fromEntry(invalidEntry);

      expect(() => ledger.meta).toThrow(INVALID_METADATA_XDR);
    });

    it("should parse header lazily (memoized)", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);

      const header1 = ledger.header;
      const header2 = ledger.header;

      expect(header1).toBe(header2); // Same object reference (memoized)
      expect(header1).toBeDefined();
    });

    it("should parse metadata lazily (memoized)", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);

      const meta1 = ledger.meta;
      const meta2 = ledger.meta;

      expect(meta1).toBe(meta2); // Same object reference (memoized)
      expect(meta1).toBeDefined();
    });
  });

  describe("Version Detection", () => {
    it("should detect ledger version", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);
      const version = ledger.version;

      expect(["v0", "v1", "v2"]).toContain(version);
    });
  });

  describe("Header Properties", () => {
    it("should expose header properties", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);

      expect(typeof ledger.protocolVersion).toBe("number");
      expect(ledger.previousLedgerHash).toBeDefined();
      expect(typeof ledger.previousLedgerHash).toBe("string");
      expect(typeof ledger.totalCoins).toBe("bigint");
      expect(typeof ledger.feePool).toBe("bigint");
    });

    it("should expose closedAt as Date", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);

      expect(ledger.closedAt).toBeInstanceOf(Date);
    });
  });

  describe("Transactions", () => {
    it("should parse transactions array", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);
      const transactions = ledger.transactions;

      expect(Array.isArray(transactions)).toBe(true);
      expect(transactions.length).toBeGreaterThan(0);

      transactions.forEach((tx) => {
        expect(tx.index).toBeGreaterThanOrEqual(0);
      });
    });

    it("should return transactionCount", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);

      expect(ledger.transactionCount).toBe(ledger.transactions.length);
    });

    it("should get transaction by index", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);

      const tx0 = ledger.getTransaction(0);
      expect(tx0).toBeDefined();
      expect(tx0?.index).toBe(0);

      const txUndefined = ledger.getTransaction(99999);
      expect(txUndefined).toBeUndefined();
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON", () => {
      const ledger = Ledger.fromEntry(ledgerEntry);
      const json = ledger.toJSON();

      expect(json.sequence).toBe(ledger.sequence);
      expect(json.hash).toBe(ledger.hash);
      expect(json.ledgerCloseTime).toBe(ledger.ledgerCloseTime);
      expect(json.closedAt).toBeDefined();
      expect(json.version).toBe(ledger.version);
      expect(json.protocolVersion).toBe(ledger.protocolVersion);
      expect(json.transactionCount).toBe(ledger.transactionCount);
      expect(json.totalCoins).toBe(ledger.totalCoins.toString());
      expect(json.feePool).toBe(ledger.feePool.toString());
      expect(json.previousLedgerHash).toBe(ledger.previousLedgerHash);
    });
  });

  describe("Multi-Version Support", () => {
    let multiFixtures: ReturnType<typeof loadMultiVersionFixtures>;

    beforeAll(() => {
      multiFixtures = loadMultiVersionFixtures();
    });

    it("should parse LedgerCloseMeta v0", () => {
      const ledger = Ledger.fromEntry(multiFixtures.lcm_v0);

      expect(ledger.version).toBe("v0");
      expect(ledger.sequence).toBe(30000000);
      expect(ledger.transactions.length).toBeGreaterThan(0);

      // v0 transactions SHOULD have envelopes (from txSet.txes())
      const tx = ledger.transactions[0];
      expect(tx.hasEnvelope).toBe(true);
      expect(tx.hash).toBeDefined();
      expect(tx.sourceAccount).toBeDefined();
      expect(tx.sequence).toBeDefined();
      expect(tx.operations.length).toBeGreaterThan(0);
    });

    it("should parse LedgerCloseMeta v1", () => {
      const ledger = Ledger.fromEntry(multiFixtures.lcm_v1);

      expect(ledger.version).toBe("v1");
      expect(ledger.sequence).toBe(55000000);
      expect(ledger.transactions.length).toBeGreaterThan(0);

      // v1 transactions SHOULD have envelopes (from txSet v1TxSet.phases())
      const tx = ledger.transactions[0];
      expect(tx.hasEnvelope).toBe(true);
      expect(tx.hash).toBeDefined();
      expect(tx.sourceAccount).toBeDefined();
      expect(tx.sequence).toBeDefined();
      expect(tx.operations.length).toBeGreaterThan(0);
    });

    it("should parse LedgerCloseMeta v2", () => {
      const ledger = Ledger.fromEntry(multiFixtures.lcm_v2);

      expect(ledger.version).toBe("v2");
      expect(ledger.sequence).toBe(60661500);
      expect(ledger.transactions.length).toBeGreaterThan(0);

      // v2 transactions SHOULD have envelopes (from txSet)
      const tx = ledger.transactions[0];
      expect(tx.hasEnvelope).toBe(true);
      expect(tx.hash).toBeDefined();
      expect(tx.sourceAccount).toBeDefined();
      expect(tx.sequence).toBeDefined();
      expect(tx.operations.length).toBeGreaterThan(0);
    });

    it("should handle envelope availability correctly", () => {
      // ALL versions have envelopes from txSet
      // v0: from txSet.txes()
      // v1/v2: from txSet.v1TxSet().phases()
      const v0 = Ledger.fromEntry(multiFixtures.lcm_v0);
      const v1 = Ledger.fromEntry(multiFixtures.lcm_v1);
      const v2 = Ledger.fromEntry(multiFixtures.lcm_v2);

      for (const tx of v0.transactions) {
        expect(tx.hasEnvelope).toBe(true);
      }

      for (const tx of v1.transactions) {
        expect(tx.hasEnvelope).toBe(true);
      }

      for (const tx of v2.transactions) {
        expect(tx.hasEnvelope).toBe(true);
      }
    });
  });

  describe("Integration", () => {
    it("should parse complete ledger hierarchy for all fixtures", () => {
      for (const entry of fixtures) {
        const ledger = Ledger.fromEntry(entry);

        expect(ledger.sequence).toBe(entry.sequence);

        const transactions = ledger.transactions;
        for (const tx of transactions) {
          expect(tx.hash).toBeDefined();

          // Only test operations if envelope is available
          if (tx.hasEnvelope) {
            const operations = tx.operations;
            for (const op of operations) {
              expect(op.type).toBeDefined();
            }
          }
        }
      }
    });

    it("should parse both v2 fixtures with full envelope support", () => {
      for (const entry of v2Fixtures) {
        const ledger = Ledger.fromEntry(entry);

        expect(ledger.version).toBe("v2");

        for (const tx of ledger.transactions) {
          expect(tx.hasEnvelope).toBe(true);
          expect(tx.sourceAccount).toBeDefined();
          expect(tx.sequence > 0n).toBe(true);
          expect(tx.operations.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Edge Cases for 100% Coverage", () => {
    it("should wrap non-Error objects in header parsing", () => {
      // Create entry with XDR that will throw a non-Error
      const invalidEntry = { ...ledgerEntry, headerXdr: "!!!!" };
      const ledger = Ledger.fromEntry(invalidEntry);

      expect(() => ledger.header).toThrow(INVALID_HEADER_XDR);
    });

    it("should wrap non-Error objects in metadata parsing", () => {
      // Create entry with XDR that will throw a non-Error
      const invalidEntry = { ...ledgerEntry, metadataXdr: "!!!!" };
      const ledger = Ledger.fromEntry(invalidEntry);

      expect(() => ledger.meta).toThrow(INVALID_METADATA_XDR);
    });

    it("should throw UNSUPPORTED_LEDGER_CLOSE_META_VERSION for unknown version in version getter", () => {
      // Create a mock that returns an unsupported version from meta.switch()
      const ledger = Ledger.fromEntry(ledgerEntry);

      // Mock the meta property to return a fake version
      Object.defineProperty(ledger, "meta", {
        get: () => ({
          switch: () => 99, // Unsupported version
        }),
        configurable: true,
      });

      expect(() => ledger.version).toThrow(
        UNSUPPORTED_LEDGER_CLOSE_META_VERSION
      );
    });

    it("should throw UNSUPPORTED_LEDGER_CLOSE_META_VERSION for unknown version in transactions getter", () => {
      // Create a mock that returns an unsupported version
      const ledger = Ledger.fromEntry(ledgerEntry);

      // Mock the version property to return an unknown value
      Object.defineProperty(ledger, "version", {
        get: () => "v99" as "v0" | "v1" | "v2",
        configurable: true,
      });

      expect(() => ledger.transactions).toThrow(
        UNSUPPORTED_LEDGER_CLOSE_META_VERSION
      );
    });

    it("should fallback to fromMeta when envelope not found in v2 txSet", () => {
      // Load a real V2 fixture
      const v2Fixtures = loadV2Fixtures();
      if (v2Fixtures.length === 0) return;

      const ledger = Ledger.fromEntry(v2Fixtures[0]);

      // Override extractEnvelopesFromGeneralizedTxSet to return empty array
      // This tests the fallback path at lines 244-246
      // deno-lint-ignore no-explicit-any
      (ledger as any).extractEnvelopesFromGeneralizedTxSet = () => [];

      // Clear memoized transactions to force re-parsing
      // deno-lint-ignore no-explicit-any
      delete (ledger as any)._transactions;

      // Should still work but transactions won't have envelopes
      const transactions = ledger.transactions;

      // Transactions should exist but won't have envelopes (fromMeta fallback)
      expect(transactions.length).toBeGreaterThan(0);
      for (const tx of transactions) {
        expect(tx.hasEnvelope).toBe(false);
      }
    });

    it("should fallback to fromMeta when envelope not found in v1 txSet", () => {
      const multiFixtures = loadMultiVersionFixtures();
      const ledger = Ledger.fromEntry(multiFixtures.lcm_v1);

      // Override extractEnvelopesFromGeneralizedTxSet to return empty array
      // deno-lint-ignore no-explicit-any
      (ledger as any).extractEnvelopesFromGeneralizedTxSet = () => [];

      // Clear memoized transactions
      // deno-lint-ignore no-explicit-any
      delete (ledger as any)._transactions;

      const transactions = ledger.transactions;
      expect(transactions.length).toBeGreaterThan(0);
      for (const tx of transactions) {
        expect(tx.hasEnvelope).toBe(false);
      }
    });

    it("should fallback to fromMeta when envelope not found in v0 txSet", () => {
      const multiFixtures = loadMultiVersionFixtures();
      const ledger = Ledger.fromEntry(multiFixtures.lcm_v0);

      // Override meta to return empty envelopes array
      const originalMeta = ledger.meta;
      Object.defineProperty(ledger, "meta", {
        get: () => {
          const v0 = originalMeta.v0();
          return {
            switch: () => 0,
            v0: () => ({
              ...v0,
              txSet: () => ({
                txes: () => [], // Empty envelopes
              }),
              txProcessing: () => v0.txProcessing(),
            }),
          };
        },
        configurable: true,
      });

      // Clear memoized transactions
      // deno-lint-ignore no-explicit-any
      delete (ledger as any)._transactions;

      const transactions = ledger.transactions;
      expect(transactions.length).toBeGreaterThan(0);
      for (const tx of transactions) {
        expect(tx.hasEnvelope).toBe(false);
      }
    });

    it("should handle phase.switch().name fallback for arm detection", () => {
      // This tests line 275: the ?? fallback when arm() is not available
      const multiFixtures = loadMultiVersionFixtures();
      const ledger = Ledger.fromEntry(multiFixtures.lcm_v2);

      // Mock the extractEnvelopesFromGeneralizedTxSet to test the fallback path
      // Create a phase that has no arm() method, forcing use of switch().name
      // deno-lint-ignore no-explicit-any
      const originalExtract = (ledger as any)
        .extractEnvelopesFromGeneralizedTxSet;

      // deno-lint-ignore no-explicit-any
      (ledger as any).extractEnvelopesFromGeneralizedTxSet = function (
        // deno-lint-ignore no-explicit-any
        txSet: any
      ) {
        const txSetV1 = txSet.v1TxSet();
        const phases = txSetV1.phases();

        // Wrap phases to remove arm() method
        const wrappedPhases = phases.map(
          // deno-lint-ignore no-explicit-any
          (phase: any) => ({
            // Remove arm(), keep switch()
            switch: phase.switch.bind(phase),
            v0Components: phase.v0Components?.bind(phase),
            parallelTxsComponent: phase.parallelTxsComponent?.bind(phase),
          })
        );

        // Create mock txSet with wrapped phases
        const mockTxSet = {
          v1TxSet: () => ({
            phases: () => wrappedPhases,
          }),
        };

        // Call original with mock
        return originalExtract.call(this, mockTxSet);
      };

      // Clear memoized transactions
      // deno-lint-ignore no-explicit-any
      delete (ledger as any)._transactions;

      // Should still work using switch().name fallback
      const transactions = ledger.transactions;
      expect(transactions.length).toBeGreaterThan(0);
    });
  });
});
