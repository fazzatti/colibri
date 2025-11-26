// deno-lint-ignore-file require-await no-explicit-any
import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";
import { EventFilter, EventType } from "@colibri/core";
import { Server } from "stellar-sdk/rpc";
import { EventStreamer } from "@/index.ts";
import * as E from "@/error.ts";

// =============================================================================
// Test Constants
// =============================================================================

const TEST_RPC_URL = "https://test-rpc.example.com";
const TEST_ARCHIVE_RPC_URL = "https://test-archive-rpc.example.com";
const TEST_CONTRACT_ID =
  "CB23WRDQWGSP6YPMY4UV5C4OW5CBTXKYN3XEATG7KJEZCXMJBYEHOUOV";

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
 * Creates a mock events response with all required SDK fields
 */
const createMockEventsResponse = (
  overrides: {
    events?: Array<{
      id: string;
      ledger: number;
      contractId?: { address: () => { toString: () => string } };
    }>;
    latestLedger?: number;
    cursor?: string;
  } = {}
) =>
  ({
    events: overrides.events ?? [],
    latestLedger: overrides.latestLedger ?? 100000,
    oldestLedger: 90000,
    latestLedgerCloseTime: 1700000000,
    oldestLedgerCloseTime: 1699990000,
    cursor: overrides.cursor,
  } as const);

/**
 * Creates a mock ledgers response with all required SDK fields
 */
const createMockLedgersResponse = (
  overrides: {
    ledgers?: Array<{ metadataXdr: string }>;
  } = {}
) =>
  ({
    ledgers: overrides.ledgers ?? [],
    latestLedger: 100000,
    latestLedgerCloseTime: 1700000000,
    oldestLedger: 1,
    oldestLedgerCloseTime: 1600000000,
    cursor: "test-cursor",
  } as const);

/**
 * Creates a mock event
 */
const createMockEvent = (overrides: { id?: string; ledger?: number } = {}) => ({
  id: overrides.id ?? `event-${Math.random().toString(36).substring(7)}`,
  ledger: overrides.ledger ?? 100000,
  type: "contract" as const,
  contractId: {
    address: () => ({ toString: () => TEST_CONTRACT_ID }),
  },
  topic: [],
  value: {},
});

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
 * Stubs rpc.getEvents with a mock response
 */
function stubGetEvents(
  rpc: Server,
  responseFn: (args?: any) => ReturnType<typeof createMockEventsResponse>
): AnyStub {
  return stub(rpc, "getEvents" as any, responseFn as any) as AnyStub;
}

/**
 * Stubs rpc.getLedgers with a mock response
 */
function stubGetLedgers(
  rpc: Server,
  responseFn: (
    args?: any
  ) =>
    | ReturnType<typeof createMockLedgersResponse>
    | Promise<ReturnType<typeof createMockLedgersResponse>>
): AnyStub {
  return stub(rpc, "getLedgers" as any, responseFn as any) as AnyStub;
}

// =============================================================================
// Tests: Constructor & Options
// =============================================================================

describe("EventStreamer Unit Tests", () => {
  describe("Constructor", () => {
    it("creates with minimal options (RPC URL only)", () => {
      const streamer = new EventStreamer({ rpcUrl: TEST_RPC_URL });
      assertEquals(streamer.filters.length, 0);
    });

    it("creates with all options specified", () => {
      const filter = new EventFilter({
        type: EventType.Contract,
        contractIds: [TEST_CONTRACT_ID],
      });

      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        filters: [filter],
        options: {
          limit: 50,
          waitLedgerIntervalMs: 3000,
          pagingIntervalMs: 50,
          archivalIntervalMs: 200,
          skipLedgerWaitIfBehind: true,
        },
      });

      assertEquals(streamer.filters.length, 1);
    });

    it("throws PAGING_INTERVAL_TOO_LONG if pagingIntervalMs > waitLedgerIntervalMs", () => {
      assertThrows(
        () => {
          new EventStreamer({
            rpcUrl: TEST_RPC_URL,
            options: {
              waitLedgerIntervalMs: 100,
              pagingIntervalMs: 200, // Greater than wait interval
            },
          });
        },
        E.PAGING_INTERVAL_TOO_LONG,
        "Paging interval is too long"
      );
    });
  });

  // ===========================================================================
  // Tests: Getters and Setters
  // ===========================================================================

  describe("Getters and Setters", () => {
    let streamer: EventStreamer;

    beforeEach(() => {
      streamer = new EventStreamer({ rpcUrl: TEST_RPC_URL });
    });

    it("get rpc returns the RPC server instance", () => {
      const rpc = streamer.rpc;
      assertEquals(rpc instanceof Server, true);
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

    it("get filters returns the filters array", () => {
      assertEquals(streamer.filters.length, 0);
    });

    it("set filters updates the filters via setFilters", () => {
      const filter = new EventFilter({
        type: EventType.Contract,
        contractIds: [TEST_CONTRACT_ID],
      });
      streamer.filters = [filter];
      assertEquals(streamer.filters.length, 1);
    });

    it("setFilters sets the filters directly", () => {
      const filter = new EventFilter({ type: EventType.System });
      streamer.setFilters([filter]);
      assertEquals(streamer.filters.length, 1);
    });

    it("clearFilters resets filters to empty array", () => {
      const filter = new EventFilter({ type: EventType.Contract });
      streamer.setFilters([filter]);
      assertEquals(streamer.filters.length, 1);

      streamer.clearFilters();
      assertEquals(streamer.filters.length, 0);
    });

    it("setArchiveRpc sets the archive RPC server", () => {
      assertEquals(streamer.archiveRpc, undefined);
      streamer.setArchiveRpc(TEST_ARCHIVE_RPC_URL);
      assertEquals(streamer.archiveRpc instanceof Server, true);
    });
  });

  // ===========================================================================
  // Tests: startLive() Errors
  // ===========================================================================

  describe("startLive() - Error Handling", () => {
    let streamer: EventStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
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
      const eventsStub = stub(streamer.rpc, "getEvents" as any, () => {
        callCount++;
        // Keep returning "at tip" response to make it wait
        return Promise.resolve(
          createMockEventsResponse({ events: [], latestLedger: 95000 })
        );
      });
      stubs.push(eventsStub);

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
        "Event streamer is already running"
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

      const eventsStub = stub(streamer.rpc, "getEvents" as any, () =>
        Promise.reject(new Error("Network error"))
      );
      stubs.push(eventsStub);

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

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [],
          latestLedger: 100000,
        })
      );
      stubs.push(eventsStub);

      // Call startLive WITHOUT startLedger - should default to latestLedger (100000)
      await streamer.startLive(async () => {}, {
        stopLedger: 100000,
      });

      // Verify that getEvents was called (means it started from latestLedger)
      assertSpyCalls(eventsStub, 1);
    });
  });

  // ===========================================================================
  // Tests: startArchive() Errors
  // ===========================================================================

  describe("startArchive() - Error Handling", () => {
    let streamer: EventStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new EventStreamer({
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
      // but will eventually resolve to avoid hanging
      let resolveDelayedPromise: () => void;
      const delayedPromise = new Promise<
        ReturnType<typeof createMockLedgersResponse>
      >((resolve) => {
        resolveDelayedPromise = () =>
          resolve(createMockLedgersResponse({ ledgers: [] }));
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
        "Event streamer is already running"
      );

      // Clean up: stop the streamer and resolve the pending promise
      streamer.stop();
      resolveDelayedPromise!();
      await runningPromise;
    });

    it("throws MISSING_ARCCHIVE_RPC if no archive RPC is configured", async () => {
      const streamerNoArchive = new EventStreamer({ rpcUrl: TEST_RPC_URL });

      await assertRejects(
        () =>
          streamerNoArchive.startArchive(async () => {}, {
            startLedger: 1000,
            stopLedger: 1005,
          }),
        E.MISSING_ARCCHIVE_RPC,
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

    it("re-throws errors from ingestHistoricalLedger and sets isRunning to false", async () => {
      const ledgersStub = stub(streamer.archiveRpc!, "getLedgers" as any, () =>
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
    let streamer: EventStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
        },
      });
      stubs = [];
    });

    afterEach(() => {
      streamer.stop();
      stubs.forEach((s) => s.restore());
    });

    it("throws STREAMER_ALREADY_RUNNING if already running", async () => {
      // Use a delayed health response to keep the streamer "starting"
      let resolveHealth: (
        value: ReturnType<typeof createMockHealthResponse>
      ) => void;
      let healthCallCount = 0;

      const healthStub = stub(streamer.rpc, "getHealth" as any, () => {
        healthCallCount++;
        if (healthCallCount === 1) {
          // First call returns immediately to start the streamer
          return Promise.resolve(
            createMockHealthResponse({
              oldestLedger: 90000,
              latestLedger: 95000,
            })
          );
        }
        // Subsequent calls are delayed to keep streamer in running state
        return new Promise((resolve) => {
          resolveHealth = resolve;
        });
      });
      stubs.push(healthStub);

      const eventsStub = stub(streamer.rpc, "getEvents" as any, () => {
        // Return "at tip" response
        return Promise.resolve(
          createMockEventsResponse({ events: [], latestLedger: 95000 })
        );
      });
      stubs.push(eventsStub);

      // Start streamer in background with stopLedger to eventually terminate
      const runningPromise = streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      // Wait for it to start and make at least one call
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Try to start again - should fail because already running
      await assertRejects(
        () => streamer.start(async () => {}),
        E.STREAMER_ALREADY_RUNNING,
        "Event streamer is already running"
      );

      // Clean up
      streamer.stop();
      // Resolve any pending health check to allow clean termination
      if (resolveHealth!) {
        resolveHealth!(
          createMockHealthResponse({ oldestLedger: 90000, latestLedger: 95000 })
        );
      }
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

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [],
          latestLedger: 100000,
        })
      );
      stubs.push(eventsStub);

      // Call start WITHOUT startLedger - should default to latestLedger (100000)
      await streamer.start(async () => {}, {
        stopLedger: 100000,
      });

      // Verify that getEvents was called (means it started from latestLedger)
      assertSpyCalls(eventsStub, 1);
    });
  });

  // ===========================================================================
  // Tests: start() - Historical Mode (with Archive RPC)
  // These tests mock ingestHistoricalLedger to avoid XDR parsing while still
  // covering the targetLedger calculation logic and loop continuation.
  // ===========================================================================

  describe("start() - Historical Mode", () => {
    it("throws LEDGER_TOO_OLD when startLedger is too old and no archive RPC configured", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
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
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
          archivalIntervalMs: 1,
        },
      });

      // Track what targetLedger is passed to ingestHistoricalLedger
      let capturedTargetLedger: number | undefined;

      // Stub ingestHistoricalLedger on the prototype to capture args and skip XDR parsing
      const ingestHistoricalStub = stub(
        EventStreamer.prototype as any,
        "ingestHistoricalLedger",
        (...args: unknown[]) => {
          capturedTargetLedger = args[1] as number; // target is second arg
          // Return a ledger that's now in live range, so it exits historical mode
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
        // After historical ingestion, return latestLedger = currentLedger to trigger stop
        return createMockHealthResponse({
          oldestLedger: 90000,
          latestLedger: 90002, // Now at tip, will exit after live ingest
        });
      });

      const eventsStub = stubGetEvents(streamer.rpc, () => {
        // After getEvents, stop the streamer to exit the loop
        streamer.stop();
        return createMockEventsResponse({
          events: [],
          latestLedger: 90002,
        });
      });

      // startLedger=85000 < oldestAvailable(90002), NO stopLedger provided
      // targetLedger should be oldestAvailable - 1 = 90001 (the else branch)
      await streamer.start(async () => {}, { startLedger: 85000 });

      // Verify targetLedger = oldestAvailable - 1 = 90001
      assertEquals(capturedTargetLedger, 90001);

      ingestHistoricalStub.restore();
      healthStub.restore();
      eventsStub.restore();
    });

    it("calculates targetLedger as Math.min(oldestAvailable-1, stopLedger) when stopLedger provided", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
          archivalIntervalMs: 1,
        },
      });

      let capturedTargetLedger: number | undefined;

      const ingestHistoricalStub = stub(
        EventStreamer.prototype as any,
        "ingestHistoricalLedger",
        (...args: unknown[]) => {
          capturedTargetLedger = args[1] as number; // target is second arg
          // Return stopLedger + 1 to trigger exit
          return Promise.resolve(88001);
        }
      ) as AnyStub;

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({
          oldestLedger: 90000, // oldestAvailable = 90002
          latestLedger: 100000,
        })
      );

      // startLedger=85000, stopLedger=88000
      // stopLedger(88000) < oldestAvailable-1(90001), so targetLedger = 88000
      await streamer.start(async () => {}, {
        startLedger: 85000,
        stopLedger: 88000,
      });

      // Verify targetLedger = Math.min(90001, 88000) = 88000
      assertEquals(capturedTargetLedger, 88000);

      ingestHistoricalStub.restore();
      healthStub.restore();
    });

    it("continues loop after historical ingestion to re-check oldestAvailable", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
          archivalIntervalMs: 1,
        },
      });

      let ingestHistoricalCallCount = 0;

      const ingestHistoricalStub = stub(
        EventStreamer.prototype as any,
        "ingestHistoricalLedger",
        (..._args: unknown[]) => {
          ingestHistoricalCallCount++;
          // First call: return ledger still in historical range
          if (ingestHistoricalCallCount === 1) {
            return Promise.resolve(89000);
          }
          // Second call: return ledger now in live range
          return Promise.resolve(90002);
        }
      ) as AnyStub;

      let healthCallCount = 0;
      const healthStub = stubGetHealth(streamer.rpc, () => {
        healthCallCount++;
        // Calls 1-3: keep ledger in historical range (85000 and 89000 are both < 90002)
        // Call 1: initial rpcDetails check
        // Call 2: first loop iteration health check → triggers historical mode
        // Call 3: after continue, second loop health check → triggers historical mode again
        if (healthCallCount <= 3) {
          return createMockHealthResponse({
            oldestLedger: 90000, // oldestAvailable = 90002
            latestLedger: 100000,
          });
        }
        // Call 4+: now in live range (90002 >= 88002)
        return createMockHealthResponse({
          oldestLedger: 88000, // oldestAvailable shifted to 88002
          latestLedger: 90002,
        });
      });

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [],
          latestLedger: 90002,
        })
      );

      await streamer.start(async () => {}, {
        startLedger: 85000,
        stopLedger: 90002,
      });

      // Should have called ingestHistoricalLedger twice due to continue
      assertEquals(ingestHistoricalCallCount, 2);

      ingestHistoricalStub.restore();
      healthStub.restore();
      eventsStub.restore();
    });
  });

  // ===========================================================================
  // Tests: ingestLiveLedger - Various Paths
  // ===========================================================================

  describe("ingestLiveLedger - Various Paths", () => {
    let streamer: EventStreamer;
    let stubs: AnyStub[] = [];

    beforeEach(() => {
      streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
          skipLedgerWaitIfBehind: false,
        },
      });
      stubs = [];
    });

    afterEach(() => {
      streamer.stop();
      stubs.forEach((s) => s.restore());
    });

    it("skips already processed events (duplicate detection)", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      let callCount = 0;
      const eventsStub = stub(streamer.rpc, "getEvents" as any, () => {
        callCount++;
        if (callCount <= 2) {
          // Return same event twice to test deduplication
          return Promise.resolve(
            createMockEventsResponse({
              events: [createMockEvent({ id: "same-event-id", ledger: 95000 })],
              latestLedger: 95000,
            })
          );
        }
        // Third call - different event on next ledger
        return Promise.resolve(
          createMockEventsResponse({
            events: [createMockEvent({ id: "new-event-id", ledger: 95001 })],
            latestLedger: 95001,
          })
        );
      });
      stubs.push(eventsStub);

      const events: unknown[] = [];
      await streamer.startLive(
        async (event) => {
          events.push(event);
        },
        { startLedger: 95000, stopLedger: 95001 }
      );

      // Should only have 2 events, not 3 (deduplication worked)
      assertEquals(events.length, 2);
    });

    it("handles pagination with cursor", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      let callCount = 0;

      const eventsStub = stub(streamer.rpc, "getEvents" as any, () => {
        callCount++;
        if (callCount === 1) {
          // First page with cursor
          return Promise.resolve(
            createMockEventsResponse({
              events: [createMockEvent({ id: "event-1", ledger: 95000 })],
              latestLedger: 95000,
              cursor: "cursor-page-2",
            })
          );
        }
        // Second page, no more cursor
        return Promise.resolve(
          createMockEventsResponse({
            events: [createMockEvent({ id: "event-2", ledger: 95000 })],
            latestLedger: 95000,
          })
        );
      });
      stubs.push(eventsStub);

      const events: unknown[] = [];
      await streamer.startLive(
        async (event) => {
          events.push(event);
        },
        { startLedger: 95000, stopLedger: 95000 }
      );

      // Should have fetched 2 pages
      assertSpyCalls(eventsStub, 2);
      assertEquals(events.length, 2);
    });

    it("returns shouldWait=true when latestLedger < ledgerSequence", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 95000 })
      );
      stubs.push(healthStub);

      let callCount = 0;
      const eventsStub = stub(streamer.rpc, "getEvents" as any, () => {
        callCount++;
        if (callCount === 1) {
          // First call: chain is behind (latestLedger < requested)
          return Promise.resolve(
            createMockEventsResponse({
              events: [],
              latestLedger: 94999, // Behind the requested ledger
            })
          );
        }
        // Second call: chain caught up
        return Promise.resolve(
          createMockEventsResponse({
            events: [],
            latestLedger: 95000,
          })
        );
      });
      stubs.push(eventsStub);

      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      // Should have waited and retried
      assertSpyCalls(eventsStub, 2);
    });

    it("returns shouldWait=true when latestLedger === ledgerSequence", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 95000 })
      );
      stubs.push(healthStub);

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [],
          latestLedger: 95000, // Exactly at the tip
        })
      );
      stubs.push(eventsStub);

      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      // Should complete successfully
      assertSpyCalls(eventsStub, 1);
    });

    it("respects skipLedgerWaitIfBehind option when catching up", async () => {
      const streamerSkip = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 100,
          pagingIntervalMs: 5,
          skipLedgerWaitIfBehind: true, // Should skip waiting
        },
      });

      const healthStub = stubGetHealth(streamerSkip.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 95005 })
      );
      stubs.push(healthStub);

      const eventsStub = stubGetEvents(streamerSkip.rpc, () =>
        createMockEventsResponse({
          events: [],
          latestLedger: 95005, // Ahead of requested
        })
      );
      stubs.push(eventsStub);

      const startTime = Date.now();
      await streamerSkip.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95002,
      });
      const elapsed = Date.now() - startTime;

      // With skipLedgerWaitIfBehind=true, should be fast (no 100ms waits)
      // Allow some buffer for execution time
      assertEquals(elapsed < 500, true);
    });

    it("stops processing when event.ledger > stopLedger (hitStopLedger)", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [
            createMockEvent({ id: "event-1", ledger: 95000 }),
            createMockEvent({ id: "event-2", ledger: 95001 }), // Past stopLedger
          ],
          latestLedger: 95001,
        })
      );
      stubs.push(eventsStub);

      const events: unknown[] = [];
      await streamer.startLive(
        async (event) => {
          events.push(event);
        },
        { startLedger: 95000, stopLedger: 95000 }
      );

      // Should have only processed the first event
      assertEquals(events.length, 1);
    });

    it("handles more than 25 events for circular buffer overflow", async () => {
      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      // Generate 30 unique events
      const manyEvents = Array.from({ length: 30 }, (_, i) =>
        createMockEvent({ id: `event-${i}`, ledger: 95000 })
      );

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: manyEvents,
          latestLedger: 95000,
        })
      );
      stubs.push(eventsStub);

      const events: unknown[] = [];
      await streamer.startLive(
        async (event) => {
          events.push(event);
        },
        { startLedger: 95000, stopLedger: 95000 }
      );

      // All 30 events should be processed (buffer only prevents duplicates)
      assertEquals(events.length, 30);
    });
  });

  // ===========================================================================
  // Tests: stop() method
  // ===========================================================================

  describe("stop()", () => {
    it("sets isRunning to false and stops the loop", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 1000,
          pagingIntervalMs: 5,
        },
      });

      const stubs: AnyStub[] = [];

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({ events: [], latestLedger: 95000 })
      );
      stubs.push(eventsStub);

      // Start in background
      const promise = streamer.startLive(async () => {}, {
        startLedger: 95000,
      });

      // Wait a tick then stop
      await new Promise((resolve) => setTimeout(resolve, 20));
      streamer.stop();

      // Should complete without throwing
      await promise;

      stubs.forEach((s) => s.restore());
    });

    it("returns fallback when stopped mid-ingestion", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
        },
      });

      const stubs: AnyStub[] = [];

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      let callCount = 0;
      const eventsStub = stub(streamer.rpc, "getEvents" as any, () => {
        callCount++;
        if (callCount === 1) {
          // Stop during first call
          streamer.stop();
        }
        return Promise.resolve(
          createMockEventsResponse({ events: [], latestLedger: 95000 })
        );
      });
      stubs.push(eventsStub);

      await streamer.startLive(async () => {}, { startLedger: 95000 });

      // Should have stopped after first call
      assertEquals(callCount, 1);

      stubs.forEach((s) => s.restore());
    });
  });

  // ===========================================================================
  // Tests: fetchEvents (private method tested via startLive)
  // ===========================================================================

  describe("fetchEvents paths", () => {
    it("uses cursor when provided (pagination path)", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
        },
      });

      const stubs: AnyStub[] = [];

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      const calls: unknown[] = [];
      const eventsStub = stub(
        streamer.rpc,
        "getEvents" as any,
        (args: unknown) => {
          calls.push(args);
          if (calls.length === 1) {
            return Promise.resolve(
              createMockEventsResponse({
                events: [createMockEvent({ id: "e1", ledger: 95000 })],
                latestLedger: 95000,
                cursor: "test-cursor",
              })
            );
          }
          return Promise.resolve(
            createMockEventsResponse({ events: [], latestLedger: 95000 })
          );
        }
      );
      stubs.push(eventsStub);

      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      // First call should have startLedger, second should have cursor
      assertEquals(calls.length, 2);

      stubs.forEach((s) => s.restore());
    });
  });

  // ===========================================================================
  // Tests: start() - Live Mode Complete Path
  // ===========================================================================

  describe("start() - Live Mode", () => {
    it("processes events in live mode when startLedger >= oldestAvailable", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
        },
      });

      const stubs: AnyStub[] = [];

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [createMockEvent({ id: "live-event", ledger: 95000 })],
          latestLedger: 95000,
        })
      );
      stubs.push(eventsStub);

      const events: unknown[] = [];
      await streamer.start(
        async (event) => {
          events.push(event);
        },
        { startLedger: 95000, stopLedger: 95000 }
      );

      assertEquals(events.length, 1);

      stubs.forEach((s) => s.restore());
    });

    it("stops when currentLedger > stopLedger at start of loop", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
        },
      });

      const stubs: AnyStub[] = [];

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [],
          latestLedger: 95002,
        })
      );
      stubs.push(eventsStub);

      await streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95001,
      });

      stubs.forEach((s) => s.restore());
    });

    it("handles hitStopLedger in live mode", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
        },
      });

      const stubs: AnyStub[] = [];

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 })
      );
      stubs.push(healthStub);

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [
            createMockEvent({ id: "e1", ledger: 95000 }),
            createMockEvent({ id: "e2", ledger: 95002 }), // Past stop
          ],
          latestLedger: 95002,
        })
      );
      stubs.push(eventsStub);

      const events: unknown[] = [];
      await streamer.start(
        async (event) => {
          events.push(event);
        },
        { startLedger: 95000, stopLedger: 95000 }
      );

      // Only first event should be processed
      assertEquals(events.length, 1);

      stubs.forEach((s) => s.restore());
    });

    it("waits when shouldWait is true and not past stopLedger", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
        },
      });

      const stubs: AnyStub[] = [];

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 95000 })
      );
      stubs.push(healthStub);

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [],
          latestLedger: 95000, // At the tip, should wait
        })
      );
      stubs.push(eventsStub);

      await streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      stubs.forEach((s) => s.restore());
    });

    it("skips wait when shouldWait but past stopLedger", async () => {
      const streamer = new EventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 10,
          pagingIntervalMs: 5,
        },
      });

      const stubs: AnyStub[] = [];

      const healthStub = stubGetHealth(streamer.rpc, () =>
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 95005 })
      );
      stubs.push(healthStub);

      const eventsStub = stubGetEvents(streamer.rpc, () =>
        createMockEventsResponse({
          events: [],
          latestLedger: 95000, // At the tip for this ledger
        })
      );
      stubs.push(eventsStub);

      const startTime = Date.now();
      await streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000, // Immediate stop after first ledger
      });
      const elapsed = Date.now() - startTime;

      // Should be fast, no extra waits
      assertEquals(elapsed < 100, true);

      stubs.forEach((s) => s.restore());
    });
  });
});
