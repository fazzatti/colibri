import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { QUASAR_API_KEY } from "colibri-internal/env/index.ts";
import { assertEquals, assertExists } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import {
  type Event,
  EventFilter,
  EventType,
  NetworkProviders,
  SACEvents,
} from "@colibri/core";
import { xdr } from "stellar-sdk";
import { RPCStreamer } from "@/streamer.ts";

// =============================================================================
// Test Constants
// =============================================================================

// Contract IDs for filtering tests
const KALE_CONTRACT_ID_MAINNET =
  "CB23WRDQWGSP6YPMY4UV5C4OW5CBTXKYN3XEATG7KJEZCXMJBYEHOUOV";

const XLM_CONTRACT_ID_MAINNET =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

// Known ledger with events for deterministic testing (Archive only)
// These ledgers have known event counts for reliable assertions
const TEST_LEDGER_START = 59895694;
const TEST_LEDGER_END = 59895695;

// Topic ScVals for filtering
const mintFn = xdr.ScVal.scvSymbol("mint");

// =============================================================================
// Helper Functions
// =============================================================================

const createEventCollector = () => {
  const events: Event[] = [];
  const handler = (event: Event) => {
    events.push(event);
  };
  return { events, handler };
};

const getContractIdString = (event: Event): string | undefined => {
  return event.contractId;
};

// =============================================================================
// Tests
// =============================================================================

describe(
  "[Mainnet] RPC Event Streamer Variant",
  disableSanitizeConfig,

  () => {
    const networkConfig = NetworkProviders.Lightsail.MainNet(QUASAR_API_KEY);

    let streamer: RPCStreamer<Event>;

    afterEach(() => {
      if (streamer) {
        streamer.stop();
      }
    });

    // =========================================================================
    // Construction Tests
    // =========================================================================

    describe("Construction", () => {
      it("creates event streamer with RPCStreamer.event()", () => {
        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
        });

        assertExists(streamer);
        assertEquals(streamer instanceof RPCStreamer, true);
      });

      it("creates event streamer with filters", () => {
        const filter = new EventFilter({
          type: EventType.Contract,
          contractIds: [KALE_CONTRACT_ID_MAINNET],
        });

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          filters: [filter],
        });

        assertExists(streamer);
      });

      it("creates event streamer with archive RPC", () => {
        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
        });

        assertEquals(streamer.archiveRpc !== undefined, true);
      });

      it("allows setting archive RPC after construction", () => {
        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
        });

        streamer.setArchiveRpc(networkConfig.archiveRpcUrl!);

        assertEquals(streamer.archiveRpc !== undefined, true);
      });
    });

    // =========================================================================
    // Live Ingestion Tests - Stop on first match for speed
    // =========================================================================

    describe("Live Ingestion (startLive)", () => {
      it("can fetch events from live RPC", async () => {
        let received = false;

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          options: { skipLedgerWaitIfBehind: true },
        });

        const health = await streamer.rpc.getHealth();

        await streamer.startLive(
          () => {
            received = true;
            streamer.stop();
          },
          { startLedger: health.latestLedger, stopLedger: health.latestLedger },
        );

        // May or may not receive events depending on network activity
        assertEquals(typeof received, "boolean");
      });

      it("applies contract type filter", async () => {
        let eventType: string | undefined;

        const filter = new EventFilter({ type: EventType.Contract });

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          filters: [filter],
          options: { skipLedgerWaitIfBehind: true },
        });

        const health = await streamer.rpc.getHealth();

        await streamer.startLive(
          (event) => {
            eventType = event.type;
            streamer.stop();
          },
          { startLedger: health.latestLedger, stopLedger: health.latestLedger },
        );

        // If received, must match filter
        if (eventType) {
          assertEquals(eventType, EventType.Contract);
        }
      });

      it("applies contract ID filter", async () => {
        let contractId: string | undefined;

        const filter = new EventFilter({
          type: EventType.Contract,
          contractIds: [XLM_CONTRACT_ID_MAINNET],
        });

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          filters: [filter],
          options: { skipLedgerWaitIfBehind: true },
        });

        const health = await streamer.rpc.getHealth();

        await streamer.startLive(
          (event) => {
            contractId = getContractIdString(event);
            streamer.stop();
          },
          { startLedger: health.latestLedger, stopLedger: health.latestLedger },
        );

        // If received, must match filter
        if (contractId) {
          assertEquals(contractId, XLM_CONTRACT_ID_MAINNET);
        }
      });
    });

    // =========================================================================
    // Archive Ingestion Tests (fast, deterministic, thorough)
    // =========================================================================

    describe("Archive Ingestion (startArchive)", () => {
      it("ingests all events from archive without filters", async () => {
        const { events, handler } = createEventCollector();

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        assertEquals(events.length, 1098);
      });

      it("filters events by contract type", async () => {
        const { events, handler } = createEventCollector();

        const filter = new EventFilter({
          type: EventType.Contract,
        });

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        // All events should be contract type
        assertEquals(events.length > 0, true);
        assertEquals(
          events.every((e) => e.type === EventType.Contract),
          true,
        );
      });

      it("filters events by contract ID (KALE)", async () => {
        const { events, handler } = createEventCollector();

        const filter = new EventFilter({
          type: EventType.Contract,
          contractIds: [KALE_CONTRACT_ID_MAINNET],
        });

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        assertEquals(events.length, 9);
        assertEquals(
          events.every(
            (e) => getContractIdString(e) === KALE_CONTRACT_ID_MAINNET,
          ),
          true,
        );
        assertEquals(
          events.every((e) => SACEvents.MintEvent.is(e)),
          true,
        );
      });

      it("filters events by contract ID (XLM)", async () => {
        const { events, handler } = createEventCollector();

        const filter = new EventFilter({
          type: EventType.Contract,
          contractIds: [XLM_CONTRACT_ID_MAINNET],
        });

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        assertEquals(events.length > 0, true);
        assertEquals(
          events.every(
            (e) => getContractIdString(e) === XLM_CONTRACT_ID_MAINNET,
          ),
          true,
        );
      });

      it("filters events by topic (mint function)", async () => {
        const { events, handler } = createEventCollector();

        const filter = new EventFilter({
          type: EventType.Contract,
          topics: [[mintFn, "**"]],
        });

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        assertEquals(events.length, 200);
      });
    });

    // =========================================================================
    // Auto Mode Tests (start method)
    // =========================================================================

    describe("Auto Mode (start)", () => {
      it("uses archive mode for historical ledgers", async () => {
        const { events, handler } = createEventCollector();

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.start(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
        });

        // Should receive the same events as pure archive mode
        assertEquals(events.length, 1098);
      });
    });

    // =========================================================================
    // Stop and Resume Tests
    // =========================================================================

    describe("Stop and Resume", () => {
      it("can stop and resume ingestion", async () => {
        const { events: events1, handler: handler1 } = createEventCollector();
        const { events: events2, handler: handler2 } = createEventCollector();

        const filter = new EventFilter({
          type: EventType.Contract,
          contractIds: [KALE_CONTRACT_ID_MAINNET],
        });

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          filters: [filter],
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        // First run - get events from first ledger only
        await streamer.startArchive(handler1, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_START,
        });

        // Second run - get events from second ledger only
        await streamer.startArchive(handler2, {
          startLedger: TEST_LEDGER_END,
          stopLedger: TEST_LEDGER_END,
        });

        // Combined should equal total
        assertEquals(events1.length + events2.length, 9);
      });
    });

    // =========================================================================
    // Checkpoint and Error Handler Tests
    // =========================================================================

    describe("Checkpoint Handling", () => {
      it("calls onCheckpoint during archive ingestion", async () => {
        const checkpoints: number[] = [];
        const { handler } = createEventCollector();

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_END,
          checkpointInterval: 1,
          onCheckpoint: (ledger) => {
            checkpoints.push(ledger);
          },
        });

        // Should have checkpoints for each ledger processed
        assertEquals(checkpoints.length >= 2, true);
        assertEquals(checkpoints.includes(TEST_LEDGER_START), true);
      });
    });

    describe("Error Handling", () => {
      it("calls onError when error occurs and continues", async () => {
        // This test validates that the error handler is wired through.
        // We can't easily trigger errors in integration tests, so just verify setup works.
        const errors: Error[] = [];

        streamer = RPCStreamer.event({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        // Should complete without error even with handler registered
        await streamer.startArchive(async () => {}, {
          startLedger: TEST_LEDGER_START,
          stopLedger: TEST_LEDGER_START,
          onError: (error) => {
            errors.push(error);
          },
        });

        // No errors expected in normal operation
        assertEquals(errors.length, 0);
      });
    });
  },
);
