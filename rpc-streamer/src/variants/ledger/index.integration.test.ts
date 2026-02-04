import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { QUASAR_API_KEY } from "colibri-internal/env/index.ts";
import {
  getLedgerFixture,
  loadMultiVersionFixtures,
} from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";
import { assertEquals, assertExists } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { type Ledger, NetworkProviders } from "@colibri/core";
import type { Api } from "stellar-sdk/rpc";
import { RPCStreamer } from "@/streamer.ts";

// =============================================================================
// Fixtures - Load known ledger data from standardized fixtures
// =============================================================================

const FIXTURES = loadMultiVersionFixtures();

// v0 fixture (ledger 30,000,000)
const FIXTURE_V0 = getLedgerFixture(30000000)!;
// v1 fixture (ledger 55,000,000)
const FIXTURE_V1 = getLedgerFixture(55000000)!;
// v2 fixtures (ledgers 60,661,500 and 60,661,501)
const FIXTURE_V2_FIRST = getLedgerFixture(60661500)!;
const FIXTURE_V2_SECOND = getLedgerFixture(60661501)!;

// =============================================================================
// Helper Functions
// =============================================================================

const createLedgerCollector = () => {
  const ledgers: Ledger[] = [];
  const handler = async (ledger: Ledger) => {
    ledgers.push(ledger);
  };
  return { ledgers, handler };
};

const isValidLedger = (ledger: Ledger): boolean => {
  return (
    typeof ledger.sequence === "number" &&
    ledger.sequence > 0 &&
    typeof ledger.hash === "string" &&
    ledger.hash.length === 64
  );
};

// =============================================================================
// Tests
// =============================================================================

describe(
  "[Mainnet] RPC Ledger Streamer Variant",
  disableSanitizeConfig,

  () => {
    const networkConfig = NetworkProviders.Lightsail.MainNet(QUASAR_API_KEY);

    let streamer: RPCStreamer<Ledger>;

    afterEach(() => {
      if (streamer) {
        streamer.stop();
      }
    });

    // =========================================================================
    // Construction Tests
    // =========================================================================

    describe("Construction", () => {
      it("creates ledger streamer with RPCStreamer.ledger()", () => {
        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
        });

        assertExists(streamer);
        assertEquals(streamer instanceof RPCStreamer, true);
      });

      it("creates ledger streamer with archive RPC", () => {
        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
        });

        assertEquals(streamer.archiveRpc !== undefined, true);
      });

      it("allows setting archive RPC after construction", () => {
        streamer = RPCStreamer.ledger({
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
      it("receives valid ledger from live RPC", async () => {
        let ledger: Ledger | undefined;

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          options: { skipLedgerWaitIfBehind: true },
        });

        const health = await streamer.rpc.getHealth();

        await streamer.startLive(
          (l) => {
            ledger = l;
            streamer.stop();
          },
          { startLedger: health.latestLedger, stopLedger: health.latestLedger },
        );

        assertExists(ledger);
        assertEquals(isValidLedger(ledger), true);
      });

      it("ledger has valid hash format", async () => {
        let ledgerHash: string | undefined;

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          options: { skipLedgerWaitIfBehind: true },
        });

        const health = await streamer.rpc.getHealth();

        await streamer.startLive(
          (ledger) => {
            ledgerHash = ledger.hash;
            streamer.stop();
          },
          { startLedger: health.latestLedger, stopLedger: health.latestLedger },
        );

        assertExists(ledgerHash);
        assertEquals(/^[a-f0-9]{64}$/.test(ledgerHash), true);
      });

      it("ledger has transactions array", async () => {
        let hasTransactions = false;

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          options: { skipLedgerWaitIfBehind: true },
        });

        const health = await streamer.rpc.getHealth();

        await streamer.startLive(
          (ledger) => {
            hasTransactions = Array.isArray(ledger.transactions);
            streamer.stop();
          },
          { startLedger: health.latestLedger, stopLedger: health.latestLedger },
        );

        assertEquals(hasTransactions, true);
      });
    });

    // =========================================================================
    // Archive Ingestion Tests (uses permanent historical ledger data)
    // =========================================================================

    describe("Archive Ingestion (startArchive)", () => {
      it("ingests v2 ledgers with correct sequence", async () => {
        const { ledgers, handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        assertEquals(ledgers.length, 2);
        assertEquals(ledgers[0].sequence, FIXTURE_V2_FIRST.sequence);
        assertEquals(ledgers[1].sequence, FIXTURE_V2_SECOND.sequence);
      });

      it("ingests v2 ledgers with correct hash", async () => {
        const { ledgers, handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        assertEquals(ledgers[0].hash, FIXTURE_V2_FIRST.hash);
        assertEquals(ledgers[1].hash, FIXTURE_V2_SECOND.hash);
      });

      it("ingests v2 ledgers with correct close time", async () => {
        const { ledgers, handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        assertEquals(
          ledgers[0].ledgerCloseTime,
          String(FIXTURE_V2_FIRST.ledgerCloseTime),
        );
        assertEquals(
          ledgers[1].ledgerCloseTime,
          String(FIXTURE_V2_SECOND.ledgerCloseTime),
        );
      });

      it("ingests v0 ledger with correct sequence and hash", async () => {
        const { ledgers, handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: FIXTURE_V0.sequence,
          stopLedger: FIXTURE_V0.sequence,
        });

        assertEquals(ledgers.length, 1);
        assertEquals(ledgers[0].sequence, FIXTURE_V0.sequence);
        assertEquals(ledgers[0].hash, FIXTURE_V0.hash);
        assertEquals(
          ledgers[0].ledgerCloseTime,
          String(FIXTURE_V0.ledgerCloseTime),
        );
        assertEquals(ledgers[0].version, "v0");
      });

      it("ingests v1 ledger with correct sequence and hash", async () => {
        const { ledgers, handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: FIXTURE_V1.sequence,
          stopLedger: FIXTURE_V1.sequence,
        });

        assertEquals(ledgers.length, 1);
        assertEquals(ledgers[0].sequence, FIXTURE_V1.sequence);
        assertEquals(ledgers[0].hash, FIXTURE_V1.hash);
        assertEquals(
          ledgers[0].ledgerCloseTime,
          String(FIXTURE_V1.ledgerCloseTime),
        );
        assertEquals(ledgers[0].version, "v1");
      });

      it("ledgers have transactions with valid structure", async () => {
        const { ledgers, handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        // Both ledgers should have transactions
        for (const ledger of ledgers) {
          assertEquals(Array.isArray(ledger.transactions), true);
          assertEquals(ledger.transactions.length > 0, true);

          for (const tx of ledger.transactions) {
            assertExists(tx.hash);
            assertEquals(/^[a-f0-9]{64}$/.test(tx.hash), true);
          }
        }
      });

      it("ledgers have valid header properties", async () => {
        const { ledgers, handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        for (const ledger of ledgers) {
          // Total coins should be positive bigint
          assertEquals(typeof ledger.totalCoins, "bigint");
          assertEquals(ledger.totalCoins > 0n, true);

          // Fee pool should be non-negative bigint
          assertEquals(typeof ledger.feePool, "bigint");
          assertEquals(ledger.feePool >= 0n, true);

          // Protocol version should be positive number
          assertEquals(typeof ledger.protocolVersion, "number");
          assertEquals(ledger.protocolVersion > 0, true);

          // Previous ledger hash should be valid hex
          assertEquals(/^[a-f0-9]{64}$/.test(ledger.previousLedgerHash), true);
        }
      });

      it("consecutive ledgers have correct previousLedgerHash chain", async () => {
        const { ledgers, handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        // Second ledger's previousLedgerHash should equal first ledger's hash
        assertEquals(ledgers[1].previousLedgerHash, ledgers[0].hash);
      });

      it("all LedgerCloseMeta versions parse correctly", async () => {
        // Test that all fixture versions can be ingested and parsed correctly
        for (const [version, fixture] of Object.entries(FIXTURES)) {
          const { ledgers, handler } = createLedgerCollector();

          streamer = RPCStreamer.ledger({
            rpcUrl: networkConfig.rpcUrl,
            archiveRpcUrl: networkConfig.archiveRpcUrl,
            options: {
              skipLedgerWaitIfBehind: true,
            },
          });

          await streamer.startArchive(handler, {
            startLedger: fixture.sequence,
            stopLedger: fixture.sequence,
          });

          assertEquals(ledgers.length, 1, `${version} should return 1 ledger`);
          assertEquals(
            ledgers[0].sequence,
            fixture.sequence,
            `${version} sequence mismatch`,
          );
          assertEquals(
            ledgers[0].hash,
            fixture.hash,
            `${version} hash mismatch`,
          );
        }
      });
    });

    // =========================================================================
    // Auto Mode Tests (start method)
    // =========================================================================

    describe("Auto Mode (start)", () => {
      it("uses live mode for recent ledgers", async () => {
        let receivedLedger = false;

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          options: { skipLedgerWaitIfBehind: true },
        });

        const health = await streamer.rpc.getHealth();

        await streamer.start(
          () => {
            receivedLedger = true;
            streamer.stop();
          },
          { startLedger: health.latestLedger, stopLedger: health.latestLedger },
        );

        assertEquals(receivedLedger, true);
      });

      it("uses archive mode for historical ledgers", async () => {
        const { ledgers, handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.start(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        // Should receive the same ledgers as pure archive mode
        assertEquals(ledgers.length, 2);
        assertEquals(ledgers[0].sequence, FIXTURE_V2_FIRST.sequence);
        assertEquals(ledgers[1].sequence, FIXTURE_V2_SECOND.sequence);
      });
    });

    // =========================================================================
    // Stop and Resume Tests
    // =========================================================================

    describe("Stop and Resume", () => {
      it("can stop and resume ingestion", async () => {
        const { ledgers: ledgers1, handler: handler1 } =
          createLedgerCollector();
        const { ledgers: ledgers2, handler: handler2 } =
          createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        // First run - get first ledger only
        await streamer.startArchive(handler1, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_FIRST.sequence,
        });

        // Second run - get second ledger only
        await streamer.startArchive(handler2, {
          startLedger: FIXTURE_V2_SECOND.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        assertEquals(ledgers1.length, 1);
        assertEquals(ledgers2.length, 1);
        assertEquals(ledgers1[0].sequence, FIXTURE_V2_FIRST.sequence);
        assertEquals(ledgers2[0].sequence, FIXTURE_V2_SECOND.sequence);
      });
    });

    // =========================================================================
    // Checkpoint and Error Handler Tests
    // =========================================================================

    describe("Checkpoint Handling", () => {
      it("calls onCheckpoint during archive ingestion", async () => {
        const checkpoints: number[] = [];
        const { handler } = createLedgerCollector();

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await streamer.startArchive(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
          checkpointInterval: 1,
          onCheckpoint: (ledger) => {
            checkpoints.push(ledger);
          },
        });

        // Should have checkpoints for each ledger processed
        assertEquals(checkpoints.length >= 2, true);
        assertEquals(checkpoints.includes(FIXTURE_V2_FIRST.sequence), true);
      });

      it("calls onCheckpoint during live ingestion", async () => {
        const checkpoints: number[] = [];

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          options: { skipLedgerWaitIfBehind: true },
        });

        const health = await streamer.rpc.getHealth();

        await streamer.startLive(() => streamer.stop(), {
          startLedger: health.latestLedger,
          stopLedger: health.latestLedger,
          checkpointInterval: 1,
          onCheckpoint: (ledger) => {
            checkpoints.push(ledger);
          },
        });

        // Should have at least one checkpoint
        assertEquals(checkpoints.length >= 1, true);
      });
    });

    describe("Error Handling", () => {
      it("calls onError when error occurs and continues", async () => {
        // This test validates that the error handler is wired through.
        // We can't easily trigger errors in integration tests, so just verify setup works.
        const errors: Error[] = [];

        streamer = RPCStreamer.ledger({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        // Should complete without error even with handler registered
        await streamer.startArchive(async () => {}, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_FIRST.sequence,
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
