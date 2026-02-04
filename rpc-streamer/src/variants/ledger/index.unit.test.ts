// deno-lint-ignore-file require-await no-explicit-any
import { assertEquals } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { type Stub, stub } from "@std/testing/mock";
import { Ledger } from "@colibri/core";
import { createLedgerStreamer } from "@/variants/ledger/index.ts";

// =============================================================================
// Test Constants
// =============================================================================

const TEST_RPC_URL = "https://test-rpc.example.com";
const TEST_ARCHIVE_RPC_URL = "https://archive-rpc.example.com";

// =============================================================================
// Mock Helpers
// =============================================================================

function createMockHealthResponse(
  overrides: Partial<{
    status: string;
    oldestLedger: number;
    latestLedger: number;
  }> = {},
) {
  return {
    status: overrides.status ?? "healthy",
    oldestLedger: overrides.oldestLedger ?? 90000,
    latestLedger: overrides.latestLedger ?? 100000,
    ledgerRetentionWindow: 17280,
  };
}

function createMockLedgerEntry(sequence: number) {
  return {
    sequence,
    hash: `hash-${sequence}`,
    headerXdr: "mockHeaderXdr",
    metadataXdr: "mockMetadataXdr",
    ledgerCloseTime: Date.now(),
  };
}

// =============================================================================
// Tests: Ledger Streamer Ingestor Coverage
// =============================================================================

describe("Ledger Streamer Ingestors", () => {
  let stubs: Stub<any, any[], any>[] = [];

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    stubs = [];
  });

  describe("Live Ingestor", () => {
    it("waits when ledger not available (empty response)", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95002 })),
      );
      stubs.push(healthStub);

      let callCount = 0;
      const getLedgersStub = stub(streamer.rpc as any, "_getLedgers", () => {
        callCount++;
        if (callCount === 1) {
          // First call: ledger not available yet
          return Promise.resolve({ ledgers: [] });
        }
        // Second call: ledger available
        return Promise.resolve({
          ledgers: [createMockLedgerEntry(95000)],
          latestLedger: 95002,
        });
      });
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      const startTime = Date.now();
      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });
      const elapsed = Date.now() - startTime;

      // Should have waited when no ledger available
      assertEquals(elapsed >= 10, true);
      assertEquals(callCount, 2);
    });

    it("processes single ledger and moves to next", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95002 })),
      );
      stubs.push(healthStub);

      const requestedLedgers: number[] = [];
      const getLedgersStub = stub(
        streamer.rpc as any,
        "_getLedgers",
        (opts: any) => {
          requestedLedgers.push(opts.startLedger);
          return Promise.resolve({
            ledgers: [createMockLedgerEntry(opts.startLedger)],
            latestLedger: 95002,
          });
        },
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      const receivedLedgers: number[] = [];
      await streamer.startLive(
        async (ledger) => {
          receivedLedgers.push(ledger.sequence);
        },
        { startLedger: 95000, stopLedger: 95002 },
      );

      assertEquals(receivedLedgers, [95000, 95001, 95002]);
    });

    it("returns shouldWait=true when at latest ledger", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95001 })),
      );
      stubs.push(healthStub);

      let callCount = 0;
      const getLedgersStub = stub(
        streamer.rpc as any,
        "_getLedgers",
        (opts: any) => {
          callCount++;
          return Promise.resolve({
            ledgers: [createMockLedgerEntry(opts.startLedger)],
            latestLedger: opts.startLedger, // Same as requested - we're caught up
          });
        },
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      const startTime = Date.now();
      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95001,
      });
      const elapsed = Date.now() - startTime;

      // Should have waited at least once when caught up
      assertEquals(elapsed >= 10, true);
    });

    it("hits stopLedger when ledger exceeds stop", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95010 })),
      );
      stubs.push(healthStub);

      const getLedgersStub = stub(streamer.rpc as any, "_getLedgers", () =>
        Promise.resolve({
          ledgers: [createMockLedgerEntry(95006)], // Beyond stop
          latestLedger: 95010,
        }),
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      const receivedLedgers: number[] = [];
      await streamer.startLive(
        async (ledger) => {
          receivedLedgers.push(ledger.sequence);
        },
        { startLedger: 95000, stopLedger: 95005 },
      );

      // Should not have received ledgers beyond stop
      assertEquals(receivedLedgers.length, 0);
      assertEquals(streamer.isRunning, false);
    });
  });

  describe("Archive Ingestor", () => {
    it("processes ledgers sequentially", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: { archivalIntervalMs: 5 },
      });

      const requestedLedgers: number[] = [];
      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "_getLedgers",
        (opts: any) => {
          requestedLedgers.push(opts.startLedger);
          return Promise.resolve({
            ledgers: [createMockLedgerEntry(opts.startLedger)],
          });
        },
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      const receivedLedgers: number[] = [];
      await streamer.startArchive(
        async (ledger) => {
          receivedLedgers.push(ledger.sequence);
        },
        { startLedger: 1000, stopLedger: 1004 },
      );

      assertEquals(receivedLedgers, [1000, 1001, 1002, 1003, 1004]);
    });

    it("calls checkpoint at intervals", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: { archivalIntervalMs: 5 },
      });

      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "_getLedgers",
        (opts: any) =>
          Promise.resolve({
            ledgers: [createMockLedgerEntry(opts.startLedger)],
          }),
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      const checkpoints: number[] = [];
      await streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1004,
        checkpointInterval: 2,
        onCheckpoint: (seq) => {
          checkpoints.push(seq);
        },
      });

      assertEquals(checkpoints.includes(1000), true);
      assertEquals(checkpoints.includes(1002), true);
      assertEquals(checkpoints.includes(1004), true);
    });

    it("skips empty ledger responses", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: { archivalIntervalMs: 5 },
      });

      let callCount = 0;
      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "_getLedgers",
        (opts: any) => {
          callCount++;
          // Return empty for ledger 1001
          if (opts.startLedger === 1001) {
            return Promise.resolve({ ledgers: [] });
          }
          return Promise.resolve({
            ledgers: [createMockLedgerEntry(opts.startLedger)],
          });
        },
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      const receivedLedgers: number[] = [];
      await streamer.startArchive(
        async (ledger) => {
          receivedLedgers.push(ledger.sequence);
        },
        { startLedger: 1000, stopLedger: 1003 },
      );

      // Should have skipped 1001 and continued
      assertEquals(receivedLedgers.includes(1000), true);
      assertEquals(receivedLedgers.includes(1001), false); // Skipped
      assertEquals(receivedLedgers.includes(1002), true);
      assertEquals(receivedLedgers.includes(1003), true);
    });

    it("returns early when ledger exceeds stopLedger", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: { archivalIntervalMs: 5 },
      });

      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "_getLedgers",
        () =>
          Promise.resolve({
            // Always return ledger way beyond stop
            ledgers: [createMockLedgerEntry(2000)],
          }),
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      const receivedLedgers: number[] = [];
      await streamer.startArchive(
        async (ledger) => {
          receivedLedgers.push(ledger.sequence);
        },
        { startLedger: 1000, stopLedger: 1005 },
      );

      // Should not have processed any ledgers (all beyond stop)
      assertEquals(receivedLedgers.length, 0);
    });

    it("handles errors with onError and continues", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: { archivalIntervalMs: 5 },
      });

      let callCount = 0;
      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "_getLedgers",
        (opts: any) => {
          callCount++;
          if (callCount === 2) {
            throw new Error("Network error");
          }
          return Promise.resolve({
            ledgers: [createMockLedgerEntry(opts.startLedger)],
          });
        },
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      const errors: Error[] = [];
      await streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1003,
        onError: (error) => {
          errors.push(error);
          return true; // Continue
        },
      });

      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "Network error");
    });

    it("rethrows when onError returns false", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: { archivalIntervalMs: 5 },
      });

      let callCount = 0;
      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "_getLedgers",
        () => {
          callCount++;
          if (callCount === 2) {
            throw new Error("Fatal error");
          }
          return Promise.resolve({
            ledgers: [createMockLedgerEntry(1000 + callCount - 1)],
          });
        },
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      let caughtError: Error | undefined;
      try {
        await streamer.startArchive(async () => {}, {
          startLedger: 1000,
          stopLedger: 1005,
          onError: () => false,
        });
      } catch (e) {
        caughtError = e as Error;
      }

      assertEquals(caughtError?.message, "Fatal error");
    });

    it("stops when isRunning becomes false", async () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: { archivalIntervalMs: 5 },
      });

      let processedCount = 0;
      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "_getLedgers",
        (opts: any) => {
          processedCount++;
          if (processedCount === 3) {
            streamer.stop();
          }
          return Promise.resolve({
            ledgers: [createMockLedgerEntry(opts.startLedger)],
          });
        },
      );
      stubs.push(getLedgersStub);

      const fromEntryStub = stub(
        Ledger,
        "fromEntry",
        (entry: any) =>
          ({
            sequence: entry.sequence,
            hash: entry.hash,
          }) as any,
      );
      stubs.push(fromEntryStub);

      await streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1010,
      });

      assertEquals(processedCount, 3);
    });
  });
});
