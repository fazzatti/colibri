import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { QUASAR_API_KEY } from "colibri-internal/env/index.ts";
import {
  getLedgerFixture,
  loadMultiVersionFixtures,
} from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";
import { assertEquals, assertExists } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { NetworkProviders, type Ledger } from "@colibri/core";
import type { Api } from "stellar-sdk/rpc";
import { LedgerStreamer } from "@/index.ts";

// SDK interface misses latestLedger in GetHealthResponse
type GetHealthResponse = Api.GetHealthResponse & {
  latestLedger: number;
  oldestLedger: number;
};

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

// How many ledgers to scan for live tests
const LIVE_TEST_LEDGER_WINDOW = 3;

// =============================================================================
// Helper Functions
// =============================================================================

const createLedgerCollector = () => {
  const ledgers: Ledger[] = [];
  const handler = async (ledger: Ledger) => {
    ledgers.push(ledger);
    return await Promise.resolve();
  };
  return { ledgers, handler };
};

/**
 * Validates that a ledger has the basic required structure
 */
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
  "[Mainnet] Ledger Streamer",
  disableSanitizeConfig,

  () => {
    const networkConfig = NetworkProviders.Lightsail.MainNet(QUASAR_API_KEY);

    let ledgerStreamer: LedgerStreamer;

    afterEach(() => {
      if (ledgerStreamer) {
        ledgerStreamer.stop();
      }
    });

    // =========================================================================
    // Construction Tests
    // =========================================================================

    describe("Construction", () => {
      it("creates LedgerStreamer with RPC URL only", () => {
        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
        });

        assertExists(ledgerStreamer.rpc);
      });

      it("creates LedgerStreamer with archive RPC", () => {
        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
        });

        assertEquals(ledgerStreamer.archiveRpc !== undefined, true);
      });

      it("allows setting archive RPC after construction", () => {
        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
        });

        ledgerStreamer.setArchiveRpc(networkConfig.archiveRpcUrl);

        assertEquals(ledgerStreamer.archiveRpc !== undefined, true);
      });
    });

    // =========================================================================
    // Live Ingestion Tests (uses current ledger)
    // =========================================================================

    describe("Live Ingestion (startLive)", () => {
      it("receives valid ledgers from current ledger", async () => {
        let receivedValidLedger = false;

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        const health =
          (await ledgerStreamer.rpc.getHealth()) as GetHealthResponse;
        const startLedger = health.latestLedger;

        const handler = (ledger: Ledger) => {
          if (isValidLedger(ledger)) {
            receivedValidLedger = true;
            ledgerStreamer.stop();
          }
        };

        await ledgerStreamer.startLive(handler, {
          startLedger: startLedger,
          stopLedger: startLedger + LIVE_TEST_LEDGER_WINDOW,
        });

        assertEquals(receivedValidLedger, true);
      });

      it("ledgers have correct sequential sequence numbers", async () => {
        const { ledgers, handler } = createLedgerCollector();

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        const health =
          (await ledgerStreamer.rpc.getHealth()) as GetHealthResponse;
        const startLedger = health.latestLedger;

        await ledgerStreamer.startLive(handler, {
          startLedger: startLedger,
          stopLedger: startLedger + 2,
        });

        // Verify sequential sequence numbers
        for (let i = 1; i < ledgers.length; i++) {
          assertEquals(ledgers[i].sequence, ledgers[i - 1].sequence + 1);
        }
      });

      it("ledgers have valid hash format", async () => {
        let ledgerHash: string | undefined;

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        const health =
          (await ledgerStreamer.rpc.getHealth()) as GetHealthResponse;
        const startLedger = health.latestLedger;

        const handler = (ledger: Ledger) => {
          ledgerHash = ledger.hash;
          ledgerStreamer.stop();
        };

        await ledgerStreamer.startLive(handler, {
          startLedger: startLedger,
          stopLedger: startLedger + LIVE_TEST_LEDGER_WINDOW,
        });

        assertExists(ledgerHash);
        // Hash should be 64-char lowercase hex
        assertEquals(/^[a-f0-9]{64}$/.test(ledgerHash), true);
      });

      it("ledgers have transactions array", async () => {
        let hasTransactions = false;

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        const health =
          (await ledgerStreamer.rpc.getHealth()) as GetHealthResponse;
        const startLedger = health.latestLedger;

        const handler = (ledger: Ledger) => {
          hasTransactions = Array.isArray(ledger.transactions);
          ledgerStreamer.stop();
        };

        await ledgerStreamer.startLive(handler, {
          startLedger: startLedger,
          stopLedger: startLedger + LIVE_TEST_LEDGER_WINDOW,
        });

        assertEquals(hasTransactions, true);
      });
    });

    // =========================================================================
    // Archive Ingestion Tests (uses permanent historical ledger data)
    // =========================================================================

    describe("Archive Ingestion (startArchive)", () => {
      it("ingests v2 ledgers with correct sequence", async () => {
        const { ledgers, handler } = createLedgerCollector();

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await ledgerStreamer.startArchive(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        assertEquals(ledgers.length, 2);
        assertEquals(ledgers[0].sequence, FIXTURE_V2_FIRST.sequence);
        assertEquals(ledgers[1].sequence, FIXTURE_V2_SECOND.sequence);
      });

      it("ingests v2 ledgers with correct hash", async () => {
        const { ledgers, handler } = createLedgerCollector();

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await ledgerStreamer.startArchive(handler, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        assertEquals(ledgers[0].hash, FIXTURE_V2_FIRST.hash);
        assertEquals(ledgers[1].hash, FIXTURE_V2_SECOND.hash);
      });

      it("ingests v2 ledgers with correct close time", async () => {
        const { ledgers, handler } = createLedgerCollector();

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await ledgerStreamer.startArchive(handler, {
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

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await ledgerStreamer.startArchive(handler, {
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

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await ledgerStreamer.startArchive(handler, {
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

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await ledgerStreamer.startArchive(handler, {
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

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await ledgerStreamer.startArchive(handler, {
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

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        await ledgerStreamer.startArchive(handler, {
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

          ledgerStreamer = new LedgerStreamer({
            rpcUrl: networkConfig.rpcUrl,
            archiveRpcUrl: networkConfig.archiveRpcUrl,
            options: {
              skipLedgerWaitIfBehind: true,
            },
          });

          await ledgerStreamer.startArchive(handler, {
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
    // Stop/Resume Tests
    // =========================================================================

    describe("Stop and Resume", () => {
      it("can stop and resume ingestion", async () => {
        const { ledgers: ledgers1, handler: handler1 } =
          createLedgerCollector();
        const { ledgers: ledgers2, handler: handler2 } =
          createLedgerCollector();

        ledgerStreamer = new LedgerStreamer({
          rpcUrl: networkConfig.rpcUrl,
          archiveRpcUrl: networkConfig.archiveRpcUrl,
          options: {
            skipLedgerWaitIfBehind: true,
          },
        });

        // First run - get first ledger only
        await ledgerStreamer.startArchive(handler1, {
          startLedger: FIXTURE_V2_FIRST.sequence,
          stopLedger: FIXTURE_V2_FIRST.sequence,
        });

        // Second run - get second ledger only
        await ledgerStreamer.startArchive(handler2, {
          startLedger: FIXTURE_V2_SECOND.sequence,
          stopLedger: FIXTURE_V2_SECOND.sequence,
        });

        assertEquals(ledgers1.length, 1);
        assertEquals(ledgers2.length, 1);
        assertEquals(ledgers1[0].sequence, FIXTURE_V2_FIRST.sequence);
        assertEquals(ledgers2[0].sequence, FIXTURE_V2_SECOND.sequence);
      });
    });
  },
);
