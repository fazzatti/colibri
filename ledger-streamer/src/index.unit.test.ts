// deno-lint-ignore-file require-await no-explicit-any
import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";
import { type Ledger } from "@colibri/core";
import { Server } from "stellar-sdk/rpc";
import { LedgerStreamer } from "@/index.ts";
import * as E from "@/error.ts";

// =============================================================================
// Test Constants
// =============================================================================

const TEST_RPC_URL = "https://test-rpc.example.com";
const TEST_ARCHIVE_RPC_URL = "https://test-archive-rpc.example.com";

// =============================================================================
// Mock Helpers - Using 'as const' for literal types and full required fields
// =============================================================================

/**
 * Creates a mock health response with all required SDK fields
 */
const createMockHealthResponse = (
  overrides: {
    status?: "healthy" | "unhealthy";
    latestLedger?: number;
    oldestLedger?: number;
    ledgerRetentionWindow?: number;
  } = {}
) =>
  ({
    status: overrides.status ?? ("healthy" as const),
    latestLedger: overrides.latestLedger ?? 100000,
    oldestLedger: overrides.oldestLedger ?? 90000,
    ledgerRetentionWindow: overrides.ledgerRetentionWindow ?? 10000,
  } as const);

/**
 * Creates a mock raw ledger entry (RawLedgerResponse)
 * Uses string XDR to match what _getLedgers returns
 */
const createMockRawLedgerEntry = (
  overrides: {
    sequence?: number;
    hash?: string;
    ledgerCloseTime?: string;
    headerXdr?: string;
    metadataXdr?: string;
  } = {}
) => ({
  sequence: overrides.sequence ?? 100000,
  hash: overrides.hash ?? "abc123",
  ledgerCloseTime: overrides.ledgerCloseTime ?? "1700000000",
  // Base64-encoded minimal XDR - just for testing structure
  headerXdr: overrides.headerXdr ?? "AAAAAAAAAAA=",
  metadataXdr: overrides.metadataXdr ?? "AAAAAAAAAAA=",
});

/**
 * Creates a mock raw ledgers response (RawGetLedgersResponse)
 * This mimics what _getLedgers returns (raw string XDR)
 */
const createMockRawLedgersResponse = (
  overrides: {
    ledgers?: ReturnType<typeof createMockRawLedgerEntry>[];
    latestLedger?: number;
    oldestLedger?: number;
    cursor?: string;
  } = {}
) =>
  ({
    ledgers: overrides.ledgers ?? [],
    latestLedger: overrides.latestLedger ?? 100000,
    latestLedgerCloseTime: 1700000000,
    oldestLedger: overrides.oldestLedger ?? 1,
    oldestLedgerCloseTime: 1600000000,
    cursor: overrides.cursor ?? "test-cursor",
  } as const);

// =============================================================================
// Type-safe stub helpers
// =============================================================================

type AnyStub = Stub<any, any[], any>;

/**
 * Stubs rpc.getHealth with a mock response
 */
function stubGetHealth(
  rpc: Server,
  responseFn: () => ReturnType<typeof createMockHealthResponse>
): AnyStub {
  return stub(rpc, "getHealth" as any, () =>
    Promise.resolve(responseFn())
  ) as AnyStub;
}

/**
 * Stubs rpc._getLedgers with a mock response (raw XDR strings)
 */
function stubGetLedgers(
  rpc: Server,
  responseFn: (
    args?: any
  ) =>
    | ReturnType<typeof createMockRawLedgersResponse>
    | Promise<ReturnType<typeof createMockRawLedgersResponse>>
): AnyStub {
  return stub(rpc, "_getLedgers" as any, responseFn as any) as AnyStub;
}

// =============================================================================
// Tests: Constructor & Options
// =============================================================================

describe("LedgerStreamer Unit Tests", () => {
  describe("Constructor", () => {
    it("creates with minimal options (RPC URL only)", () => {
      const streamer = new LedgerStreamer({ rpcUrl: TEST_RPC_URL });
      assertEquals(streamer.rpc instanceof Server, true);
    });

    it("creates with all options specified", () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          batchSize: 100,
          waitLedgerIntervalMs: 3000,
          archivalIntervalMs: 200,
          skipLedgerWaitIfBehind: true,
        },
      });

      assertEquals(streamer.rpc instanceof Server, true);
      assertEquals(streamer.archiveRpc instanceof Server, true);
    });

    it("creates without archive RPC when not provided", () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
      });

      assertEquals(streamer.archiveRpc, undefined);
    });
  });

  // ===========================================================================
  // Tests: Getters and Setters
  // ===========================================================================

  describe("Getters and Setters", () => {
    let streamer: LedgerStreamer;

    beforeEach(() => {
      streamer = new LedgerStreamer({ rpcUrl: TEST_RPC_URL });
    });

    it("get rpc returns the RPC server instance", () => {
      const rpc = streamer.rpc;
      assertEquals(rpc instanceof Server, true);
    });

    it("get isRunning returns false when not running", () => {
      assertEquals(streamer.isRunning, false);
    });

    it("set rpc throws RPC_ALREADY_SET if rpc is already defined", () => {
      // The rpc is already set from constructor
      const newRpc = new Server(TEST_RPC_URL);
      assertThrows(
        () => {
          streamer.rpc = newRpc;
        },
        E.RPC_ALREADY_SET,
        "RPC client is already set"
      );
    });

    it("get archiveRpc returns undefined when not set", () => {
      assertEquals(streamer.archiveRpc, undefined);
    });

    it("set archiveRpc throws ARCHIVE_RPC_ALREADY_SET if already defined", () => {
      // First set the archive RPC
      streamer.setArchiveRpc(TEST_ARCHIVE_RPC_URL);

      // Now try to set it again via the setter
      const newArchiveRpc = new Server(TEST_ARCHIVE_RPC_URL);
      assertThrows(
        () => {
          streamer.archiveRpc = newArchiveRpc;
        },
        E.ARCHIVE_RPC_ALREADY_SET,
        "Archive RPC client is already set"
      );
    });

    it("setArchiveRpc sets the archive RPC server", () => {
      assertEquals(streamer.archiveRpc, undefined);
      streamer.setArchiveRpc(TEST_ARCHIVE_RPC_URL);
      assertEquals(streamer.archiveRpc instanceof Server, true);
    });
  });

  // ===========================================================================
  // Tests: stop()
  // ===========================================================================

  describe("stop()", () => {
    it("stops the streamer gracefully", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10 },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        callCount++;
        // Return ledger at tip to cause waiting
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 100000 })],
          latestLedger: 100000,
        });
      });

      // Start streamer in background (no stopLedger)
      const runningPromise = streamer.startLive(async () => {}, {
        startLedger: 100000,
      });

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Stop should gracefully terminate
      streamer.stop();
      await runningPromise;

      healthStub.restore();
      ledgersStub.restore();
    });
  });

  // ===========================================================================
  // Tests: startLive() Errors
  // ===========================================================================

  describe("startLive() - Error Handling", () => {
    let streamer: LedgerStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
        },
      });
      stubs = [];
    });

    afterEach(() => {
      streamer.stop();
      stubs.forEach((s) => s.restore());
    });

    it("throws STREAMER_ALREADY_RUNNING if already running", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 95000 })
      );
      stubs.push(healthStub);

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        callCount++;
        // Keep returning "at tip" response to make it wait
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95000 })],
          latestLedger: 95000,
        });
      });
      stubs.push(ledgersStub);

      // Start the streamer in background (no stopLedger so it keeps running)
      const runningPromise = streamer.startLive(async () => {}, {
        startLedger: 95000,
      });

      // Wait for it to start and make at least one call
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Try to start again - should fail because already running
      await assertRejects(
        () => streamer.startLive(async () => {}),
        E.STREAMER_ALREADY_RUNNING,
        "Ledger streamer is already running"
      );

      streamer.stop();
      await runningPromise;
    });

    it("throws RPC_NOT_HEALTHY if RPC status is not healthy", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ status: "unhealthy" })
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.startLive(async () => {}),
        E.RPC_NOT_HEALTHY,
        "RPC server is not healthy"
      );
    });

    it("throws LEDGER_TOO_OLD if startLedger is below oldest available", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );
      stubs.push(healthStub);

      // oldestAvailable = 90000 + 2 = 90002
      // startLedger = 80000 < 90002
      await assertRejects(
        () => streamer.startLive(async () => {}, { startLedger: 80000 }),
        E.LEDGER_TOO_OLD,
        "Requested ledger is older than the RPC retention period"
      );
    });

    it("throws LEDGER_TOO_HIGH if startLedger is above latest ledger", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );
      stubs.push(healthStub);

      // startLedger = 150000 > latestLedger = 100000
      await assertRejects(
        () => streamer.startLive(async () => {}, { startLedger: 150000 }),
        E.LEDGER_TOO_HIGH,
        "Requested ledger is higher than the latest available ledger"
      );
    });

    it("re-throws errors from ingestLiveLedger and sets isRunning to false", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      const ledgersStub = stubGetLedgers(streamer.rpc, () =>
        Promise.reject(new Error("Network error"))
      );
      stubs.push(ledgersStub);

      await assertRejects(
        () => streamer.startLive(async () => {}, { startLedger: 95000 }),
        Error,
        "Network error"
      );
    });

    it("uses rpcDetails.latestLedger as default when startLedger is not provided", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      const ledgersStub = stubGetLedgers(streamer.rpc, () =>
        createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 100000 })],
          latestLedger: 100000,
        })
      );
      stubs.push(ledgersStub);

      // Call startLive WITHOUT startLedger - should default to latestLedger (100000)
      await streamer.startLive(async () => {}, {
        stopLedger: 100000,
      });

      // Verify that _getLedgers was called (means it started from latestLedger)
      assertSpyCalls(ledgersStub, 1);
    });
  });

  // ===========================================================================
  // Tests: startArchive() Errors
  // ===========================================================================

  describe("startArchive() - Error Handling", () => {
    let streamer: LedgerStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          archivalIntervalMs: 5,
        },
      });
      stubs = [];
    });

    afterEach(() => {
      streamer.stop();
      stubs.forEach((s) => s.restore());
    });

    it("throws STREAMER_ALREADY_RUNNING if already running", async () => {
      // Use a promise that delays long enough for us to test the "already running" error
      let resolveDelayedPromise: () => void;
      const delayedPromise = new Promise<
        ReturnType<typeof createMockRawLedgersResponse>
      >((resolve) => {
        resolveDelayedPromise = () =>
          resolve(createMockRawLedgersResponse({ ledgers: [] }));
      });

      const ledgersStub = stubGetLedgers(
        streamer.archiveRpc!,
        () => delayedPromise
      );
      stubs.push(ledgersStub);

      // Start the streamer in background
      const runningPromise = streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1000, // Single ledger
      });

      // Wait a tick for the streamer to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Try to start again - should fail because already running
      await assertRejects(
        () =>
          streamer.startArchive(async () => {}, {
            startLedger: 2000,
            stopLedger: 2005,
          }),
        E.STREAMER_ALREADY_RUNNING,
        "Ledger streamer is already running"
      );

      // Clean up: stop the streamer and resolve the pending promise
      streamer.stop();
      resolveDelayedPromise!();
      await runningPromise;
    });

    it("throws MISSING_ARCHIVE_RPC if no archive RPC is configured", async () => {
      const streamerNoArchive = new LedgerStreamer({ rpcUrl: TEST_RPC_URL });

      await assertRejects(
        () =>
          streamerNoArchive.startArchive(async () => {}, {
            startLedger: 1000,
            stopLedger: 1005,
          }),
        E.MISSING_ARCHIVE_RPC,
        "Archive RPC client is not configured"
      );
    });

    it("throws INVALID_INGESTION_RANGE if startLedger > stopLedger", async () => {
      await assertRejects(
        () =>
          streamer.startArchive(async () => {}, {
            startLedger: 2000,
            stopLedger: 1000, // Invalid: start > stop
          }),
        E.INVALID_INGESTION_RANGE,
        "Invalid ingestion range"
      );
    });

    it("re-throws errors from ingestHistoricalLedgers and sets isRunning to false", async () => {
      const ledgersStub = stub(streamer.archiveRpc!, "_getLedgers" as any, () =>
        Promise.reject(new Error("Archive network error"))
      );
      stubs.push(ledgersStub);

      await assertRejects(
        () =>
          streamer.startArchive(async () => {}, {
            startLedger: 1000,
            stopLedger: 1005,
          }),
        Error,
        "Archive network error"
      );
    });
  });

  // ===========================================================================
  // Tests: start() Errors
  // ===========================================================================

  describe("start() - Error Handling", () => {
    let streamer: LedgerStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
        },
      });
      stubs = [];
    });

    afterEach(() => {
      streamer.stop();
      stubs.forEach((s) => s.restore());
    });

    it("throws STREAMER_ALREADY_RUNNING if already running", async () => {
      let healthCallCount = 0;
      const healthStub = stub(streamer.rpc, "getHealth" as any, () => {
        healthCallCount++;
        // Keep advancing latestLedger to prevent LEDGER_TOO_HIGH
        return Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 95000 + healthCallCount,
          })
        );
      });
      stubs.push(healthStub);

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        callCount++;
        // Return "at tip" to cause waiting, keeping streamer running
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 94999 + callCount })],
          latestLedger: 95000 + callCount,
        });
      });
      stubs.push(ledgersStub);

      // Start streamer in background (no stopLedger to keep running)
      const runningPromise = streamer.start(async () => {}, {
        startLedger: 95000,
      });

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Try to start again - should fail because already running
      await assertRejects(
        () => streamer.start(async () => {}),
        E.STREAMER_ALREADY_RUNNING,
        "Ledger streamer is already running"
      );

      streamer.stop();
      await runningPromise;
    });

    it("throws RPC_NOT_HEALTHY if RPC is unhealthy", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ status: "unhealthy" })
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.start(async () => {}),
        E.RPC_NOT_HEALTHY,
        "RPC server is not healthy"
      );
    });

    it("throws LEDGER_TOO_HIGH if startLedger exceeds latestLedger", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.start(async () => {}, { startLedger: 150000 }),
        E.LEDGER_TOO_HIGH,
        "Requested ledger is higher than the latest available ledger"
      );
    });

    it("throws LEDGER_TOO_OLD if startLedger is too old and no archive RPC", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );
      stubs.push(healthStub);

      // startLedger = 80000 < oldestAvailable (90002) and no archive RPC
      await assertRejects(
        () => streamer.start(async () => {}, { startLedger: 80000 }),
        E.LEDGER_TOO_OLD,
        "Requested ledger is older than the RPC retention period"
      );
    });

    it("re-throws errors and sets isRunning to false", async () => {
      const healthStub = stub(streamer.rpc, "getHealth" as any, () =>
        Promise.reject(new Error("Connection refused"))
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.start(async () => {}),
        Error,
        "Connection refused"
      );
    });

    it("uses rpcDetails.latestLedger as default when startLedger is not provided", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      const ledgersStub = stubGetLedgers(streamer.rpc, () =>
        createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 100000 })],
          latestLedger: 100000,
        })
      );
      stubs.push(ledgersStub);

      // Call start WITHOUT startLedger - should default to latestLedger (100000)
      await streamer.start(async () => {}, {
        stopLedger: 100000,
      });

      // Verify that _getLedgers was called (means it started from latestLedger)
      assertSpyCalls(ledgersStub, 1);
    });
  });

  // ===========================================================================
  // Tests: start() - Historical Mode (with Archive RPC)
  // ===========================================================================

  describe("start() - Historical Mode", () => {
    it("throws LEDGER_TOO_OLD when startLedger is too old and no archive RPC configured", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
        },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000, // oldestAvailable = 90002
          latestLedger: 100000,
        })
      );

      // startLedger = 85000 < oldestAvailable (90002) and no archive RPC
      await assertRejects(
        () => streamer.start(async () => {}, { startLedger: 85000 }),
        E.LEDGER_TOO_OLD,
        "Requested ledger is older than the RPC retention period"
      );

      healthStub.restore();
    });

    it("calculates targetLedger as oldestAvailable-1 when no stopLedger provided", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          archivalIntervalMs: 1,
        },
      });

      // Track what ledgers are requested from archive
      let capturedStartLedger: number | undefined;

      // Stub ingestHistoricalLedgers on the prototype
      const ingestHistoricalStub = stub(
        LedgerStreamer.prototype as any,
        "ingestHistoricalLedgers",
        (...args: unknown[]) => {
          capturedStartLedger = args[0] as number; // start is first arg
          // Return a ledger that's now in live range
          return Promise.resolve(90002);
        }
      ) as AnyStub;

      let healthCallCount = 0;
      const healthStub = stubGetHealth(streamer.rpc, () => {
        healthCallCount++;
        if (healthCallCount === 1) {
          // Initial health check
          return createMockHealthResponse({
            oldestLedger: 90000, // oldestAvailable = 90002
            latestLedger: 100000,
          });
        }
        // After historical ingestion
        return createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 90002,
        });
      });

      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        streamer.stop();
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 90002 })],
          latestLedger: 90002,
        });
      });

      // startLedger=85000 < oldestAvailable(90002), NO stopLedger provided
      await streamer.start(async () => {}, { startLedger: 85000 });

      // Verify start ledger was captured
      assertEquals(capturedStartLedger, 85000);

      ingestHistoricalStub.restore();
      healthStub.restore();
      ledgersStub.restore();
    });

    it("handles error from historical ingestion with onError handler", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          archivalIntervalMs: 1,
        },
      });

      // Health returns oldestLedger: 90000 -> oldestAvailable = 90002
      // startLedger: 85000 < 90002, so historical mode is used
      const healthStub = stub(streamer.rpc, "getHealth" as any, () =>
        Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000, // oldestAvailable = 90002
            latestLedger: 100000,
          })
        )
      );

      let archiveCallCount = 0;
      const archiveStub = stubGetLedgers(streamer.archiveRpc!, (request) => {
        archiveCallCount++;
        const startSeq = request?.startLedger ?? 85000;
        if (archiveCallCount === 1) {
          // First call errors
          return Promise.reject(new Error("Archive error"));
        }
        // Subsequent calls return the requested ledger sequence
        // stopLedger is 85001, so one more successful call completes
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: startSeq })],
        });
      });

      // Live stub shouldn't be called since stopLedger is in historical range
      const liveStub = stubGetLedgers(streamer.rpc, () =>
        createMockRawLedgersResponse({
          ledgers: [],
          latestLedger: 100000,
        })
      );

      const errors: Error[] = [];
      const ledgers: number[] = [];
      await streamer.start(
        async (ledger) => {
          ledgers.push(ledger.sequence);
        },
        {
          startLedger: 85000,
          stopLedger: 85001, // Stop after 2 ledgers in historical phase
          onError: (error) => {
            errors.push(error);
          },
        }
      );

      // Error should have been caught
      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "Archive error");
      // After error at 85000, it retries from 85001 (incremented), then succeeds
      assertEquals(ledgers, [85001]);

      healthStub.restore();
      archiveStub.restore();
      liveStub.restore();
    });

    it("handles error from live ingestion with onError handler in start()", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
        },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Live error"));
        }
        // After error, succeed
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95001 })],
          latestLedger: 100000,
        });
      });

      const errors: Error[] = [];
      await streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95001,
        onError: (error) => {
          errors.push(error);
        },
      });

      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "Live error");

      healthStub.restore();
      ledgersStub.restore();
    });

    it("hits stop ledger via ingestLiveLedger in start()", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
        },
      });

      let healthCallCount = 0;
      const healthStub = stub(streamer.rpc, "getHealth" as any, () => {
        healthCallCount++;
        return Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 100000,
          })
        );
      });

      // Return ledger past stop ledger to trigger hitStopLedger
      const ledgersStub = stubGetLedgers(streamer.rpc, () =>
        createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95002 })], // Past stopLedger=95000
          latestLedger: 100000,
        })
      );

      const ledgers: number[] = [];
      await streamer.start(
        async (ledger) => {
          ledgers.push(ledger.sequence);
        },
        {
          startLedger: 95000,
          stopLedger: 95000,
        }
      );

      // Should not have processed any ledgers since first one was past stop
      assertEquals(ledgers.length, 0);

      healthStub.restore();
      ledgersStub.restore();
    });
  });

  // ===========================================================================
  // Tests: ingestLiveLedger - Various Paths
  // ===========================================================================

  describe("ingestLiveLedger - Various Paths", () => {
    let streamer: LedgerStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          skipLedgerWaitIfBehind: false,
        },
      });
      stubs = [];
    });

    afterEach(() => {
      streamer.stop();
      stubs.forEach((s) => s.restore());
    });

    it("processes multiple ledgers in sequence", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        callCount++;
        if (callCount === 1) {
          return createMockRawLedgersResponse({
            ledgers: [createMockRawLedgerEntry({ sequence: 95000 })],
            latestLedger: 100000,
          });
        }
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95001 })],
          latestLedger: 100000,
        });
      });
      stubs.push(ledgersStub);

      const ledgers: Ledger[] = [];
      await streamer.startLive(
        async (ledger) => {
          ledgers.push(ledger);
        },
        { startLedger: 95000, stopLedger: 95001 }
      );

      assertEquals(ledgers.length, 2);
    });

    it("returns shouldWait=true when no ledgers returned", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 95000 })
      );
      stubs.push(healthStub);

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        callCount++;
        if (callCount === 1) {
          // First call: no ledgers available yet
          return createMockRawLedgersResponse({
            ledgers: [],
            latestLedger: 94999,
          });
        }
        // Second call: ledger now available
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95000 })],
          latestLedger: 95000,
        });
      });
      stubs.push(ledgersStub);

      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      // Should have waited and retried
      assertSpyCalls(ledgersStub, 2);
    });

    it("returns shouldWait=true when at the tip", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 95000 })
      );
      stubs.push(healthStub);

      const ledgersStub = stubGetLedgers(streamer.rpc, () =>
        createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95000 })],
          latestLedger: 95000, // At the tip
        })
      );
      stubs.push(ledgersStub);

      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      // Should complete successfully
      assertSpyCalls(ledgersStub, 1);
    });

    it("respects skipLedgerWaitIfBehind option when catching up", async () => {
      const streamerSkip = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 100,
          skipLedgerWaitIfBehind: true, // Should skip waiting
        },
      });

      const healthStub = stubGetHealth(streamerSkip.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamerSkip.rpc, () => {
        callCount++;
        // We're behind (sequence < latestLedger), skipLedgerWaitIfBehind=true
        // should skip waiting
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 94999 + callCount })],
          latestLedger: 100000, // We're behind
        });
      });
      stubs.push(ledgersStub);

      const startTime = Date.now();
      await streamerSkip.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95001,
      });
      const elapsed = Date.now() - startTime;

      // Should have processed quickly without waiting 100ms per ledger
      assertEquals(elapsed < 50, true, `Elapsed time was ${elapsed}ms`);

      streamerSkip.stop();
    });
  });

  // ===========================================================================
  // Tests: ingestHistoricalLedgers - Various Paths
  // ===========================================================================

  describe("ingestHistoricalLedgers - Various Paths", () => {
    let streamer: LedgerStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          archivalIntervalMs: 1,
          batchSize: 5,
        },
      });
      stubs = [];
    });

    afterEach(() => {
      streamer.stop();
      stubs.forEach((s) => s.restore());
    });

    it("processes batch of ledgers from archive", async () => {
      const ledgersStub = stubGetLedgers(streamer.archiveRpc!, () =>
        createMockRawLedgersResponse({
          ledgers: [
            createMockRawLedgerEntry({ sequence: 1000 }),
            createMockRawLedgerEntry({ sequence: 1001 }),
            createMockRawLedgerEntry({ sequence: 1002 }),
          ],
        })
      );
      stubs.push(ledgersStub);

      const ledgers: Ledger[] = [];
      await streamer.startArchive(
        async (ledger) => {
          ledgers.push(ledger);
        },
        { startLedger: 1000, stopLedger: 1002 }
      );

      assertEquals(ledgers.length, 3);
    });

    it("handles multiple batches", async () => {
      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.archiveRpc!, () => {
        callCount++;
        if (callCount === 1) {
          return createMockRawLedgersResponse({
            ledgers: [
              createMockRawLedgerEntry({ sequence: 1000 }),
              createMockRawLedgerEntry({ sequence: 1001 }),
            ],
          });
        }
        return createMockRawLedgersResponse({
          ledgers: [
            createMockRawLedgerEntry({ sequence: 1002 }),
            createMockRawLedgerEntry({ sequence: 1003 }),
          ],
        });
      });
      stubs.push(ledgersStub);

      const ledgers: Ledger[] = [];
      await streamer.startArchive(
        async (ledger) => {
          ledgers.push(ledger);
        },
        { startLedger: 1000, stopLedger: 1003 }
      );

      assertEquals(ledgers.length, 4);
      assertSpyCalls(ledgersStub, 2);
    });

    it("stops when ledger exceeds stopLedger", async () => {
      const ledgersStub = stubGetLedgers(streamer.archiveRpc!, () =>
        createMockRawLedgersResponse({
          ledgers: [
            createMockRawLedgerEntry({ sequence: 1000 }),
            createMockRawLedgerEntry({ sequence: 1001 }),
            createMockRawLedgerEntry({ sequence: 1002 }), // Should stop before this
          ],
        })
      );
      stubs.push(ledgersStub);

      const ledgers: Ledger[] = [];
      await streamer.startArchive(
        async (ledger) => {
          ledgers.push(ledger);
        },
        { startLedger: 1000, stopLedger: 1001 }
      );

      // Should only process 2 ledgers
      assertEquals(ledgers.length, 2);
    });

    it("handles empty response gracefully", async () => {
      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.archiveRpc!, () => {
        callCount++;
        if (callCount === 1) {
          return createMockRawLedgersResponse({ ledgers: [] });
        }
        // Return ledger at the NEXT sequence since empty advanced us
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 1001 })],
        });
      });
      stubs.push(ledgersStub);

      await streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1001, // Extend stop to account for empty response advancing us
      });

      // Should have called twice after empty response
      assertSpyCalls(ledgersStub, 2);
    });
  });

  // ===========================================================================
  // Tests: Checkpoint Handling
  // ===========================================================================

  describe("Checkpoint Handling", () => {
    let streamer: LedgerStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
        },
      });
      stubs = [];
    });

    afterEach(() => {
      streamer.stop();
      stubs.forEach((s) => s.restore());
    });

    it("calls onCheckpoint at specified intervals", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        callCount++;
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 94999 + callCount })],
          latestLedger: 100000,
        });
      });
      stubs.push(ledgersStub);

      const checkpoints: number[] = [];
      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95003,
        checkpointInterval: 2, // Checkpoint every 2 ledgers
        onCheckpoint: (sequence) => {
          checkpoints.push(sequence);
        },
      });

      // Ledgers: 95000, 95001, 95002, 95003
      // Checkpoints at: 95000 (0 % 2 == 0), 95002 (2 % 2 == 0)
      // Actually based on code: sequence % interval === 0
      // 95000 % 2 = 0 ✓, 95001 % 2 = 1, 95002 % 2 = 0 ✓, 95003 % 2 = 1
      assertEquals(checkpoints.length, 2);
      assertEquals(checkpoints.includes(95000), true);
      assertEquals(checkpoints.includes(95002), true);
    });
  });

  // ===========================================================================
  // Tests: Error Handler
  // ===========================================================================

  describe("Error Handler", () => {
    let streamer: LedgerStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          archivalIntervalMs: 1,
        },
      });
      stubs = [];
    });

    afterEach(() => {
      streamer.stop();
      stubs.forEach((s) => s.restore());
    });

    it("calls onError and continues when handler returns true", async () => {
      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.archiveRpc!, () => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Transient error"));
        }
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 1001 })],
        });
      });
      stubs.push(ledgersStub);

      const errors: Error[] = [];
      await streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1001,
        onError: (error) => {
          errors.push(error);
        },
      });

      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "Transient error");
      assertSpyCalls(ledgersStub, 2);
    });

    it("re-throws error when no handler provided", async () => {
      const ledgersStub = stubGetLedgers(streamer.archiveRpc!, () =>
        Promise.reject(new Error("No handler error"))
      );
      stubs.push(ledgersStub);

      await assertRejects(
        () =>
          streamer.startArchive(async () => {}, {
            startLedger: 1000,
            stopLedger: 1005,
          }),
        Error,
        "No handler error"
      );
    });
  });

  // ===========================================================================
  // Tests: Error Classes
  // ===========================================================================
  // Additional Coverage Tests
  // ===========================================================================
  describe("Additional Coverage - Edge Cases", () => {
    it("startLive() hits stopLedger via ingestLiveLedger", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10 },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );

      // Return a ledger sequence that is GREATER than stopLedger
      // This triggers hitStopLedger = true in ingestLiveLedger
      const ledgersStub = stubGetLedgers(streamer.rpc, () =>
        createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95002 })],
          latestLedger: 100000,
        })
      );

      const ledgers: number[] = [];
      await streamer.startLive(
        async (ledger) => {
          ledgers.push(ledger.sequence);
        },
        { startLedger: 95000, stopLedger: 95001 }
      );

      // No ledgers should be processed because returned sequence > stopLedger
      assertEquals(ledgers, []);

      healthStub.restore();
      ledgersStub.restore();
    });

    it("startLive() handles error with onError handler", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10 },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("RPC failure"));
        }
        // Second call succeeds with stop ledger
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95001 })],
          latestLedger: 100000,
        });
      });

      const errors: Error[] = [];
      const ledgers: number[] = [];
      await streamer.startLive(
        async (ledger) => {
          ledgers.push(ledger.sequence);
        },
        {
          startLedger: 95000,
          stopLedger: 95001,
          onError: (error) => {
            errors.push(error);
          },
        }
      );

      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "RPC failure");
      assertEquals(ledgers, [95001]);

      healthStub.restore();
      ledgersStub.restore();
    });

    it("start() continues after historical error with onError handler", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          archivalIntervalMs: 1,
        },
      });

      // oldestAvailable = 90002, so startLedger 85000 needs archive
      // After historical completes at 90001, live mode continues
      let healthCallCount = 0;
      const healthStub = stub(streamer.rpc, "getHealth" as any, () => {
        healthCallCount++;
        return Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000, // oldestAvailable = 90002
            latestLedger: 100000,
          })
        );
      });

      let archiveCallCount = 0;
      const archiveStub = stubGetLedgers(streamer.archiveRpc!, (req) => {
        archiveCallCount++;
        const startSeq = req?.startLedger ?? 85000;
        if (archiveCallCount === 1) {
          // First call throws an error
          return Promise.reject(new Error("Archive connection failed"));
        }
        // Second call succeeds - return the requested ledger up to stopLedger
        if (startSeq <= 85002) {
          return createMockRawLedgersResponse({
            ledgers: [createMockRawLedgerEntry({ sequence: startSeq })],
          });
        }
        return createMockRawLedgersResponse({ ledgers: [] });
      });

      // Live stub for when we transition to live mode
      const liveStub = stubGetLedgers(streamer.rpc, () =>
        createMockRawLedgersResponse({
          ledgers: [],
          latestLedger: 100000,
        })
      );

      const errors: Error[] = [];
      const ledgers: number[] = [];
      await streamer.start(
        async (ledger) => {
          ledgers.push(ledger.sequence);
        },
        {
          startLedger: 85000,
          stopLedger: 85002, // Stop in historical range
          onError: (error) => {
            errors.push(error);
          },
        }
      );

      // The error should have been caught
      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "Archive connection failed");
      // After error at 85000, retry from 85001, then 85002
      assertEquals(ledgers, [85001, 85002]);

      healthStub.restore();
      archiveStub.restore();
      liveStub.restore();
    });

    it("ingestHistoricalLedgers stops when isRunning becomes false", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: { archivalIntervalMs: 1 },
      });

      // Return MULTIPLE ledgers in a single batch
      // This allows the for loop to iterate and check !isRunning
      const archiveStub = stubGetLedgers(streamer.archiveRpc!, () => {
        return createMockRawLedgersResponse({
          ledgers: [
            createMockRawLedgerEntry({ sequence: 1000 }),
            createMockRawLedgerEntry({ sequence: 1001 }),
            createMockRawLedgerEntry({ sequence: 1002 }),
          ],
        });
      });

      const ledgers: number[] = [];
      const startPromise = streamer.startArchive(
        async (ledger) => {
          ledgers.push(ledger.sequence);
          // Stop after first ledger - this should prevent the second from being processed
          if (ledger.sequence === 1000) {
            streamer.stop();
          }
        },
        { startLedger: 1000, stopLedger: 1005 }
      );

      await startPromise;

      // Should only process first ledger before stop takes effect in the for loop
      assertEquals(ledgers, [1000]);

      archiveStub.restore();
    });

    it("ingestLiveLedger uses entry.sequence when latestLedger is not provided", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10 },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );

      // Return response without latestLedger field by using Object.assign to remove it
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        const response = createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95000 })],
        });
        // Delete the latestLedger to test the fallback path
        const modified = { ...response };
        // @ts-ignore - intentionally removing property to test fallback
        delete modified.latestLedger;
        return modified as typeof response;
      });

      const ledgers: number[] = [];
      await streamer.startLive(
        async (ledger) => {
          ledgers.push(ledger.sequence);
        },
        { startLedger: 95000, stopLedger: 95000 }
      );

      assertEquals(ledgers, [95000]);

      healthStub.restore();
      ledgersStub.restore();
    });

    it("start() handles hitStopLedger from ingestLiveLedger", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10 },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000, // oldestAvailable = 90002
          latestLedger: 100000,
        })
      );

      // Return ledger at exactly stopLedger to trigger hitStopLedger path
      const ledgersStub = stubGetLedgers(streamer.rpc, () =>
        createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95000 })],
          latestLedger: 100000,
        })
      );

      const ledgers: number[] = [];
      await streamer.start(
        async (ledger) => {
          ledgers.push(ledger.sequence);
        },
        { startLedger: 95000, stopLedger: 95000 }
      );

      assertEquals(ledgers, [95000]);

      healthStub.restore();
      ledgersStub.restore();
    });

    it("start() handles live ingestion error with onError handler", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10 },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );

      let callCount = 0;
      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Live RPC error"));
        }
        return createMockRawLedgersResponse({
          ledgers: [createMockRawLedgerEntry({ sequence: 95001 })],
          latestLedger: 100000,
        });
      });

      const errors: Error[] = [];
      const ledgers: number[] = [];
      await streamer.start(
        async (ledger) => {
          ledgers.push(ledger.sequence);
        },
        {
          startLedger: 95000,
          stopLedger: 95001,
          onError: (error) => {
            errors.push(error);
          },
        }
      );

      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "Live RPC error");
      assertEquals(ledgers, [95001]);

      healthStub.restore();
      ledgersStub.restore();
    });

    it("start() rethrows error from historical ingestion without onError handler", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          archivalIntervalMs: 1,
        },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000, // oldestAvailable = 90002
          latestLedger: 100000,
        })
      );

      // Make archive RPC throw an error
      const archiveStub = stubGetLedgers(streamer.archiveRpc!, () => {
        return Promise.reject(new Error("Archive fatal error"));
      });

      // Should throw because no onError handler provided
      await assertRejects(
        () =>
          streamer.start(async () => {}, {
            startLedger: 85000, // Below oldestAvailable, needs archive
            stopLedger: 85005,
            // NO onError handler
          }),
        Error,
        "Archive fatal error"
      );

      healthStub.restore();
      archiveStub.restore();
    });

    it("start() rethrows error from live ingestion without onError handler", async () => {
      const streamer = new LedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10 },
      });

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 100000,
        })
      );

      const ledgersStub = stubGetLedgers(streamer.rpc, () => {
        return Promise.reject(new Error("Live fatal error"));
      });

      // Should throw because no onError handler provided
      await assertRejects(
        () =>
          streamer.start(async () => {}, {
            startLedger: 95000,
            stopLedger: 95005,
            // NO onError handler
          }),
        Error,
        "Live fatal error"
      );

      healthStub.restore();
      ledgersStub.restore();
    });
  });
});
