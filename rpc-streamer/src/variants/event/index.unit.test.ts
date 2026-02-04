// deno-lint-ignore-file require-await no-explicit-any
import { assertEquals } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { type Stub, stub } from "@std/testing/mock";
import { Event, EventFilter, EventType } from "@colibri/core";
import { createEventStreamer } from "@/variants/event/index.ts";

// =============================================================================
// Test Constants
// =============================================================================

const TEST_RPC_URL = "https://test-rpc.example.com";

// =============================================================================
// Mock Helpers
// =============================================================================

function createMockHealthResponse(
  overrides: Partial<{
    status: string;
    oldestLedger: number;
    latestLedger: number;
  }> = {},
): any {
  return {
    status: overrides.status ?? "healthy",
    oldestLedger: overrides.oldestLedger ?? 90000,
    latestLedger: overrides.latestLedger ?? 100000,
    ledgerRetentionWindow: 17280,
  };
}

function createMockEventResponse(
  id: string,
  ledger: number,
  contractId = "CTEST",
): any {
  return {
    id,
    type: "contract",
    ledger,
    ledgerClosedAt: new Date().toISOString(),
    contractId,
    topic: [],
    value: { xdr: "AAAA" },
    inSuccessfulContractCall: true,
    txHash: "txhash123",
  };
}

// =============================================================================
// Tests: Event Streamer Ingestor Coverage
// =============================================================================

describe("Event Streamer Ingestors", () => {
  let stubs: Stub<any, any[], any>[] = [];

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    stubs = [];
  });

  describe("Live Ingestor", () => {
    it("deduplicates events with circular buffer", async () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95002 })),
      );
      stubs.push(healthStub);

      // Simulate returning duplicate events
      let callCount = 0;
      const getEventsStub = stub(streamer.rpc as any, "getEvents", () => {
        callCount++;
        if (callCount <= 2) {
          // First two calls return the same event
          return Promise.resolve({
            events: [createMockEventResponse("event-dup-1", 95000)],
            latestLedger: 95002,
          });
        }
        // Third call returns new event and signals stop
        return Promise.resolve({
          events: [createMockEventResponse("event-new", 95002)],
          latestLedger: 95002,
        });
      });
      stubs.push(getEventsStub);

      // Mock Event.fromEventResponse
      const fromEventResponseStub = stub(
        Event,
        "fromEventResponse",
        (resp: any) =>
          ({
            id: resp.id,
            ledger: resp.ledger,
            contractId: resp.contractId,
          }) as any,
      );
      stubs.push(fromEventResponseStub);

      const receivedIds: string[] = [];
      await streamer.startLive(
        async (event) => {
          receivedIds.push(event.id);
        },
        { startLedger: 95000, stopLedger: 95002 },
      );

      // Should have deduplicated - event-dup-1 appears once even though returned twice
      const dupCount = receivedIds.filter((id) => id === "event-dup-1").length;
      assertEquals(dupCount, 1);
    });

    it("paginates when cursor is present", async () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95001 })),
      );
      stubs.push(healthStub);

      let callCount = 0;
      const getEventsStub = stub(
        streamer.rpc as any,
        "getEvents",
        (opts: any) => {
          callCount++;
          if (callCount === 1) {
            // First call - return with cursor
            return Promise.resolve({
              events: [createMockEventResponse("event-page1", 95000)],
              latestLedger: 95001,
              cursor: "cursor-123",
            });
          }
          if (callCount === 2 && opts.cursor === "cursor-123") {
            // Second call with cursor
            return Promise.resolve({
              events: [createMockEventResponse("event-page2", 95000)],
              latestLedger: 95001,
            });
          }
          // Later calls
          return Promise.resolve({
            events: [],
            latestLedger: 95001,
          });
        },
      );
      stubs.push(getEventsStub);

      const fromEventResponseStub = stub(
        Event,
        "fromEventResponse",
        (resp: any) =>
          ({
            id: resp.id,
            ledger: resp.ledger,
          }) as any,
      );
      stubs.push(fromEventResponseStub);

      const receivedIds: string[] = [];
      await streamer.startLive(
        async (event) => {
          receivedIds.push(event.id);
        },
        { startLedger: 95000, stopLedger: 95000 },
      );

      // Should have paginated
      assertEquals(receivedIds.includes("event-page1"), true);
      assertEquals(receivedIds.includes("event-page2"), true);
    });

    it("returns shouldWait=true when latestLedger < currentLedger", async () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      let healthCallCount = 0;
      const healthStub = stub(streamer.rpc as any, "getHealth", () => {
        healthCallCount++;
        return Promise.resolve(
          createMockHealthResponse({ latestLedger: 95000 }),
        );
      });
      stubs.push(healthStub);

      let eventsCallCount = 0;
      const getEventsStub = stub(streamer.rpc as any, "getEvents", () => {
        eventsCallCount++;
        if (eventsCallCount === 1) {
          // First call: latestLedger < requested ledger
          return Promise.resolve({
            events: [],
            latestLedger: 94999, // Behind!
          });
        }
        // After wait, return event
        return Promise.resolve({
          events: [createMockEventResponse("event-1", 95000)],
          latestLedger: 95000,
        });
      });
      stubs.push(getEventsStub);

      const fromEventResponseStub = stub(
        Event,
        "fromEventResponse",
        (resp: any) =>
          ({
            id: resp.id,
            ledger: resp.ledger,
          }) as any,
      );
      stubs.push(fromEventResponseStub);

      const startTime = Date.now();
      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });
      const elapsed = Date.now() - startTime;

      // Should have waited at least once (10ms wait interval)
      assertEquals(elapsed >= 10, true);
    });

    it("returns shouldWait=true when latestLedger === currentLedger", async () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95001 })),
      );
      stubs.push(healthStub);

      let eventsCallCount = 0;
      const getEventsStub = stub(streamer.rpc as any, "getEvents", () => {
        eventsCallCount++;
        if (eventsCallCount === 1) {
          // First call: caught up, same ledger
          return Promise.resolve({
            events: [createMockEventResponse("event-1", 95000)],
            latestLedger: 95000, // Same as current
          });
        }
        // Second call finishes
        return Promise.resolve({
          events: [],
          latestLedger: 95001,
        });
      });
      stubs.push(getEventsStub);

      const fromEventResponseStub = stub(
        Event,
        "fromEventResponse",
        (resp: any) =>
          ({
            id: resp.id,
            ledger: resp.ledger,
          }) as any,
      );
      stubs.push(fromEventResponseStub);

      const startTime = Date.now();
      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95001,
      });
      const elapsed = Date.now() - startTime;

      // Should have waited when caught up
      assertEquals(elapsed >= 10, true);
    });

    it("hits stopLedger when event exceeds stop", async () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95010 })),
      );
      stubs.push(healthStub);

      const getEventsStub = stub(streamer.rpc as any, "getEvents", () =>
        Promise.resolve({
          events: [createMockEventResponse("event-beyond", 95006)],
          latestLedger: 95010,
        }),
      );
      stubs.push(getEventsStub);

      const fromEventResponseStub = stub(
        Event,
        "fromEventResponse",
        (resp: any) =>
          ({
            id: resp.id,
            ledger: resp.ledger,
          }) as any,
      );
      stubs.push(fromEventResponseStub);

      const receivedEvents: any[] = [];
      await streamer.startLive(
        async (event) => {
          receivedEvents.push(event);
        },
        { startLedger: 95000, stopLedger: 95005 },
      );

      // Should not have received the event beyond stopLedger
      assertEquals(receivedEvents.length, 0);
      assertEquals(streamer.isRunning, false);
    });

    it("applies event filters", async () => {
      const filter = new EventFilter({
        type: EventType.Contract,
        contractIds: ["CFILTERED"],
      });

      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        filters: [filter],
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95001 })),
      );
      stubs.push(healthStub);

      let receivedFilters: any[];
      const getEventsStub = stub(
        streamer.rpc as any,
        "getEvents",
        (opts: any) => {
          receivedFilters = opts.filters;
          return Promise.resolve({
            events: [createMockEventResponse("event-1", 95000, "CFILTERED")],
            latestLedger: 95001,
          });
        },
      );
      stubs.push(getEventsStub);

      const fromEventResponseStub = stub(
        Event,
        "fromEventResponse",
        (resp: any) =>
          ({
            id: resp.id,
            ledger: resp.ledger,
            contractId: resp.contractId,
          }) as any,
      );
      stubs.push(fromEventResponseStub);

      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      // Filters should have been passed to getEvents
      assertEquals(receivedFilters!.length, 1);
    });

    it("trims circular buffer after 25 events", async () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 95030 })),
      );
      stubs.push(healthStub);

      // Generate 30 unique events
      const events = Array.from({ length: 30 }, (_, i) =>
        createMockEventResponse(`event-${i}`, 95000 + Math.floor(i / 10)),
      );

      let callCount = 0;
      const getEventsStub = stub(streamer.rpc as any, "getEvents", () => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            events: events.slice(0, 15),
            latestLedger: 95030,
          });
        } else if (callCount === 2) {
          return Promise.resolve({
            events: events.slice(15, 30),
            latestLedger: 95030,
          });
        }
        return Promise.resolve({
          events: [],
          latestLedger: 95030,
        });
      });
      stubs.push(getEventsStub);

      const fromEventResponseStub = stub(
        Event,
        "fromEventResponse",
        (resp: any) =>
          ({
            id: resp.id,
            ledger: resp.ledger,
          }) as any,
      );
      stubs.push(fromEventResponseStub);

      const receivedEvents: any[] = [];
      await streamer.startLive(
        async (event) => {
          receivedEvents.push(event);
        },
        { startLedger: 95000, stopLedger: 95003 },
      );

      // Should have received 30 events (triggering buffer trim after 25th)
      assertEquals(receivedEvents.length, 30);
    });
  });

  describe("Archive Ingestor", () => {
    it("handles error with onError and continues", async () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: "https://archive-rpc.example.com",
        options: { archivalIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ oldestLedger: 90000 })),
      );
      stubs.push(healthStub);

      let callCount = 0;
      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "getLedgers",
        () => {
          callCount++;
          if (callCount === 1) {
            throw new Error("Archive fetch error");
          }
          // Return empty on subsequent calls to exit loop
          return Promise.resolve({ ledgers: [] });
        },
      );
      stubs.push(getLedgersStub);

      const errors: Error[] = [];
      await streamer.start(async () => {}, {
        startLedger: 80000,
        stopLedger: 80001,
        onError: (error) => {
          errors.push(error);
          return true; // Continue after error
        },
      });

      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "Archive fetch error");
    });

    it("rethrows error when onError returns false", async () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: "https://archive-rpc.example.com",
        options: { archivalIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ oldestLedger: 90000 })),
      );
      stubs.push(healthStub);

      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "getLedgers",
        () => {
          throw new Error("Archive error to rethrow");
        },
      );
      stubs.push(getLedgersStub);

      let caughtError: Error | null = null;
      try {
        await streamer.start(async () => {}, {
          startLedger: 80000,
          stopLedger: 80001,
          onError: () => false, // Don't continue
        });
      } catch (error) {
        caughtError = error as Error;
      }

      assertEquals(caughtError !== null, true);
      assertEquals(caughtError!.message, "Archive error to rethrow");
    });

    it("rethrows error when no onError handler", async () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: "https://archive-rpc.example.com",
        options: { archivalIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc as any, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ oldestLedger: 90000 })),
      );
      stubs.push(healthStub);

      const getLedgersStub = stub(
        streamer.archiveRpc as any,
        "getLedgers",
        () => {
          throw new Error("Archive error no handler");
        },
      );
      stubs.push(getLedgersStub);

      let caughtError: Error | null = null;
      try {
        await streamer.start(async () => {}, {
          startLedger: 80000,
          stopLedger: 80001,
        });
      } catch (error) {
        caughtError = error as Error;
      }

      assertEquals(caughtError !== null, true);
      assertEquals(caughtError!.message, "Archive error no handler");
    });
  });
});
