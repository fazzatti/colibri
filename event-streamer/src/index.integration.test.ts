import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals } from "@std/assert";
import { afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import {
  EventFilter,
  EventType,
  NetworkProviders,
  type Event,
  SACEvents,
} from "@colibri/core";
import { xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { EventStreamer } from "@/index.ts";

// SDK interface misses latestLedger in GetHealthResponse
type GetHealthResponse = Api.GetHealthResponse & {
  latestLedger: number;
};

// =============================================================================
// Test Constants
// =============================================================================

// Contract IDs
const KALE_CONTRACT_ID_MAINNET =
  "CB23WRDQWGSP6YPMY4UV5C4OW5CBTXKYN3XEATG7KJEZCXMJBYEHOUOV";

const XLM_CONTRACT_ID_MAINNET =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

// Known ledger with events for deterministic testing (Archive only)
const TEST_LEDGER_START = 59895694;
const TEST_LEDGER_END = 59895695;

// Topic ScVals for filtering
const mintFn = xdr.ScVal.scvSymbol("mint");

// How many ledgers to scan before giving up on live tests
const LIVE_TEST_LEDGER_WINDOW = 3;

// =============================================================================
// Helper Functions
// =============================================================================

const createEventCollector = () => {
  const events: Event[] = [];
  const handler = async (event: Event) => {
    events.push(event);
    return await Promise.resolve();
  };
  return { events, handler };
};

const getContractIdString = (event: Event): string | undefined => {
  return event.contractId;
};

/**
 * Validates that an event has the basic required structure
 */
const isValidEvent = (event: Event): boolean => {
  return (
    typeof event.id === "string" &&
    typeof event.ledger === "number" &&
    event.ledger > 0
  );
};

// =============================================================================
// Tests
// =============================================================================

describe(
  "[Mainnet] Event Streamer",
  disableSanitizeConfig,

  () => {
    const networkConfig = NetworkProviders.Lightsail.MainNet();
    const archiveRpcUrl = "https://archive-rpc.lightsail.network/";

    let eventStreamer: EventStreamer;

    beforeAll(() => {
      // Setup runs before all tests
    });

    afterEach(() => {
      if (eventStreamer) {
        eventStreamer.stop();
      }
    });

    // =========================================================================
    // Construction Tests
    // =========================================================================

    describe("Construction", () => {
      it("creates EventStreamer with RPC URL only", () => {
        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
        });

        assertEquals(eventStreamer.filters.length, 0);
      });

      it("creates EventStreamer with filters", () => {
        const filter = new EventFilter({
          type: EventType.Contract,
          contractIds: [KALE_CONTRACT_ID_MAINNET],
        });

        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          filters: [filter],
        });

        assertEquals(eventStreamer.filters.length, 1);
      });

      it("creates EventStreamer with archive RPC", () => {
        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: archiveRpcUrl,
        });

        assertEquals(eventStreamer.archiveRpc !== undefined, true);
      });

      it("allows setting archive RPC after construction", () => {
        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
        });

        eventStreamer.setArchiveRpc(archiveRpcUrl);

        assertEquals(eventStreamer.archiveRpc !== undefined, true);
      });
    });

    // =========================================================================
    // Live Ingestion Tests (uses current ledger, stops on first valid event)
    // =========================================================================

    describe("Live Ingestion (startLive)", () => {
      it("receives valid events from current ledger without filters", async () => {
        let receivedValidEvent = false;

        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        const health =
          (await eventStreamer.rpc.getHealth()) as GetHealthResponse;
        const startLedger = health.latestLedger;

        const handler = (event: Event) => {
          if (isValidEvent(event)) {
            receivedValidEvent = true;
            eventStreamer.stop();
          }
        };

        await eventStreamer.startLive(handler, {
          startLedger: startLedger,
          stopLedger: startLedger + LIVE_TEST_LEDGER_WINDOW,
        });

        // We may or may not receive events depending on network activity.
        // More often than not we should receive at least one valid event.
        assertEquals(receivedValidEvent, true);
      });

      it("receives valid events with contract type filter", async () => {
        let receivedValidEvent = false;
        let eventType: string | undefined;

        const filter = new EventFilter({
          type: EventType.Contract,
        });

        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        const health =
          (await eventStreamer.rpc.getHealth()) as GetHealthResponse;
        const startLedger = health.latestLedger;

        const handler = (event: Event) => {
          if (isValidEvent(event)) {
            receivedValidEvent = true;
            eventType = event.type;
            eventStreamer.stop();
          }
        };

        await eventStreamer.startLive(handler, {
          startLedger: startLedger,
          stopLedger: startLedger + LIVE_TEST_LEDGER_WINDOW,
        });

        // If we received an event, verify it matches the filter
        if (receivedValidEvent) {
          assertEquals(eventType, EventType.Contract);
        }
      });

      it("receives valid events with contract ID filter (XLM)", async () => {
        // With unified events we should expect to see XLM contract events on mainnet
        // over a reasonable ledger window.
        let receivedValidEvent = false;
        let contractId: string | undefined;

        const filter = new EventFilter({
          type: EventType.Contract,
          contractIds: [XLM_CONTRACT_ID_MAINNET],
        });

        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        const health =
          (await eventStreamer.rpc.getHealth()) as GetHealthResponse;
        const startLedger = health.latestLedger;

        const handler = (event: Event) => {
          if (isValidEvent(event)) {
            receivedValidEvent = true;
            contractId = getContractIdString(event);
            eventStreamer.stop();
          }
        };

        await eventStreamer.startLive(handler, {
          startLedger: startLedger,
          stopLedger: startLedger + LIVE_TEST_LEDGER_WINDOW,
        });

        // If we received an event, verify it matches the filter
        if (receivedValidEvent) {
          assertEquals(contractId, XLM_CONTRACT_ID_MAINNET);
        }
      });
    });

    // =========================================================================
    // Archive Ingestion Tests (uses permanent historical ledger data)
    // =========================================================================

    describe("Archive Ingestion (startArchive)", () => {
      it("ingests all events from archive without filters", async () => {
        const { events, handler } = createEventCollector();

        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await eventStreamer.startArchive(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        assertEquals(events.length, 1098);
      });

      it("filters archive events by contract ID (KALE)", async () => {
        const { events, handler } = createEventCollector();

        const filter = new EventFilter({
          type: EventType.Contract,
          contractIds: [KALE_CONTRACT_ID_MAINNET],
        });

        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: archiveRpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await eventStreamer.startArchive(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        assertEquals(events.length, 9);
        assertEquals(
          events.every(
            (e) => getContractIdString(e) === KALE_CONTRACT_ID_MAINNET
          ),
          true
        );
        assertEquals(
          events.every((e) => SACEvents.MintEvent.is(e)),
          true
        );
      });

      it("filters archive events by topic (mint function)", async () => {
        const { events, handler } = createEventCollector();

        const filter = new EventFilter({
          type: EventType.Contract,
          topics: [[mintFn, "**"]],
        });

        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: archiveRpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await eventStreamer.startArchive(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        assertEquals(events.length, 200);
      });
    });

    // =========================================================================
    // Filter Management Tests (using Archive for deterministic results)
    // =========================================================================

    describe("Filter Management", () => {
      it("allows changing filters with setFilters", async () => {
        const { events: events1, handler: handler1 } = createEventCollector();
        const { events: events2, handler: handler2 } = createEventCollector();

        const kaleFilter = new EventFilter({
          type: EventType.Contract,
          contractIds: [KALE_CONTRACT_ID_MAINNET],
        });

        const mintFilter = new EventFilter({
          type: EventType.Contract,
          topics: [[mintFn, "**"]],
        });

        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: archiveRpcUrl,
          filters: [kaleFilter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        // First run with KALE filter
        await eventStreamer.startArchive(handler1, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        // Change filter to mint topic
        eventStreamer.setFilters([mintFilter]);

        // Second run with mint filter
        await eventStreamer.startArchive(handler2, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        assertEquals(events1.length, 9);
        assertEquals(events2.length, 200);
        assertEquals(
          events1.every(
            (e) => getContractIdString(e) === KALE_CONTRACT_ID_MAINNET
          ),
          true
        );
      });

      it("allows clearing filters with clearFilters", async () => {
        const { events: filteredEvents, handler: handler1 } =
          createEventCollector();
        const { events: unfilteredEvents, handler: handler2 } =
          createEventCollector();

        const filter = new EventFilter({
          type: EventType.Contract,
          contractIds: [KALE_CONTRACT_ID_MAINNET],
        });

        eventStreamer = new EventStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: archiveRpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        // First run with filter
        await eventStreamer.startArchive(handler1, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        // Clear filters
        eventStreamer.clearFilters();

        // Second run without filters
        await eventStreamer.startArchive(handler2, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        assertEquals(filteredEvents.length, 9);
        assertEquals(unfilteredEvents.length, 1098);
      });
    });
  }
);
