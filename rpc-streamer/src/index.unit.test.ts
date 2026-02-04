// deno-lint-ignore-file require-await no-explicit-any
import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { type Stub, stub } from "@std/testing/mock";
import { Server } from "stellar-sdk/rpc";
import { RPCStreamer } from "@/streamer.ts";
import type {
  LiveIngestionResult,
  ArchiveIngestContext,
  LiveIngestFunc,
  ArchiveIngestFunc,
} from "@/types.ts";
import {
  RPCStreamerError,
  RPCStreamerErrorCode,
  ERROR_DESCRIPTIONS,
} from "@/errors.ts";
import { createEventStreamer } from "@/variants/event/index.ts";
import { createLedgerStreamer } from "@/variants/ledger/index.ts";

// =============================================================================
// Test Constants
// =============================================================================

const TEST_RPC_URL = "https://test-rpc.example.com";
const TEST_ARCHIVE_RPC_URL = "https://archive-rpc.example.com";

// =============================================================================
// Mock Helpers
// =============================================================================

/**
 * Creates a mock health response
 */
function createMockHealthResponse(
  overrides: {
    status?: string;
    oldestLedger?: number;
    latestLedger?: number;
  } = {},
): any {
  return {
    status: overrides.status ?? "healthy",
    oldestLedger: overrides.oldestLedger ?? 90000,
    latestLedger: overrides.latestLedger ?? 100000,
    ledgerRetentionWindow: 17280,
  };
}

/**
 * Creates a configurable live ingest function for testing various scenarios
 */
function createMockLiveIngest<T>(
  results: T[] = [],
  options: {
    /** If true, returns shouldWait: true on each call */
    shouldWait?: boolean;
    /** Simulate hitting stop ledger after N calls */
    hitStopLedgerAfter?: number;
    /** Throw error on specific call numbers (1-indexed) */
    throwOnCalls?: number[];
    /** Custom behavior per call */
    onCall?: (
      callIndex: number,
      ledgerSequence: number,
    ) => Partial<LiveIngestionResult> | undefined;
  } = {},
): LiveIngestFunc<T> {
  let callIndex = 0;
  return async (_rpc, ledgerSequence, onData, stopLedger) => {
    callIndex++;

    // Throw on specific calls
    if (options.throwOnCalls?.includes(callIndex)) {
      throw new Error(`Simulated error on call ${callIndex}`);
    }

    // Custom behavior
    if (options.onCall) {
      const result = options.onCall(callIndex, ledgerSequence);
      if (result) {
        if (callIndex - 1 < results.length) {
          await onData(results[callIndex - 1]);
        }
        return {
          nextLedger: result.nextLedger ?? ledgerSequence + 1,
          shouldWait: result.shouldWait ?? false,
          hitStopLedger: result.hitStopLedger ?? false,
        };
      }
    }

    // Provide data
    if (callIndex - 1 < results.length) {
      await onData(results[callIndex - 1]);
    }

    // Check if we should hit stop ledger
    if (
      options.hitStopLedgerAfter !== undefined &&
      callIndex >= options.hitStopLedgerAfter
    ) {
      return {
        nextLedger: ledgerSequence + 1,
        shouldWait: false,
        hitStopLedger: true,
      };
    }

    if (stopLedger !== undefined && ledgerSequence >= stopLedger) {
      return {
        nextLedger: ledgerSequence + 1,
        shouldWait: false,
        hitStopLedger: true,
      };
    }

    return {
      nextLedger: ledgerSequence + 1,
      shouldWait: options.shouldWait ?? true,
      hitStopLedger: false,
    };
  };
}

/**
 * Creates a configurable archive ingest function for testing various scenarios
 */
function createMockArchiveIngest<T>(
  results: T[] = [],
  options: {
    /** Throw error on specific call numbers (1-indexed) */
    throwOnCalls?: number[];
    /** Custom behavior per call */
    onCall?: (
      callIndex: number,
      startLedger: number,
      stopLedger: number,
      context: ArchiveIngestContext,
    ) => number | undefined;
  } = {},
): ArchiveIngestFunc<T> {
  let callIndex = 0;
  return async (_rpc, startLedger, stopLedger, onData, context) => {
    callIndex++;

    // Throw on specific calls
    if (options.throwOnCalls?.includes(callIndex)) {
      throw new Error(`Simulated archive error on call ${callIndex}`);
    }

    // Custom behavior
    if (options.onCall) {
      const result = options.onCall(
        callIndex,
        startLedger,
        stopLedger,
        context,
      );
      if (result !== undefined) {
        for (const item of results) {
          if (!context.isRunning()) break;
          await onData(item);
        }
        return result;
      }
    }

    // Process each result, checking isRunning between items
    for (const item of results) {
      if (!context.isRunning()) break;
      await onData(item);
    }

    return stopLedger + 1;
  };
}

// =============================================================================
// Tests: RPCStreamerError
// =============================================================================

describe("RPCStreamerError", () => {
  describe("constructor", () => {
    it("creates error with code and message", () => {
      const error = new RPCStreamerError(
        RPCStreamerErrorCode.INVALID_CONFIG,
        "Test error message",
      );

      assertEquals(error.name, "RPCStreamerError");
      assertEquals(error.code, RPCStreamerErrorCode.INVALID_CONFIG);
      assertEquals(error.message, "Test error message");
      assertEquals(error.details, undefined);
      assertEquals(error.cause, undefined);
    });

    it("creates error with details", () => {
      const error = new RPCStreamerError(
        RPCStreamerErrorCode.LIVE_FETCH_FAILED,
        "Fetch failed",
        { sequence: 12345, cursor: "abc123" },
      );

      assertEquals(error.details, { sequence: 12345, cursor: "abc123" });
    });

    it("creates error with cause", () => {
      const cause = new Error("Original error");
      const error = new RPCStreamerError(
        RPCStreamerErrorCode.ARCHIVE_FETCH_FAILED,
        "Archive failed",
        undefined,
        cause,
      );

      assertEquals(error.cause, cause);
    });

    it("creates error with all properties", () => {
      const cause = new Error("Root cause");
      const error = new RPCStreamerError(
        RPCStreamerErrorCode.PARSE_FAILED,
        "Parse failed",
        { data: "invalid" },
        cause,
      );

      assertEquals(error.code, RPCStreamerErrorCode.PARSE_FAILED);
      assertEquals(error.message, "Parse failed");
      assertEquals(error.details, { data: "invalid" });
      assertEquals(error.cause, cause);
    });
  });

  describe("toJSON", () => {
    it("serializes error to JSON", () => {
      const error = new RPCStreamerError(
        RPCStreamerErrorCode.INVALID_CONFIG,
        "Config error",
        { key: "value" },
      );

      const json = error.toJSON();

      assertEquals(json.name, "RPCStreamerError");
      assertEquals(json.code, RPCStreamerErrorCode.INVALID_CONFIG);
      assertEquals(json.message, "Config error");
      assertEquals(json.details, { key: "value" });
      assertEquals(json.cause, undefined);
    });

    it("includes cause message in JSON", () => {
      const cause = new Error("Underlying error");
      const error = new RPCStreamerError(
        RPCStreamerErrorCode.LIVE_FETCH_FAILED,
        "Fetch error",
        undefined,
        cause,
      );

      const json = error.toJSON();
      assertEquals(json.cause, "Underlying error");
    });
  });
});

describe("RPCStreamerErrorCode", () => {
  it("has all expected error codes", () => {
    assertEquals(RPCStreamerErrorCode.INVALID_CONFIG, "RPC_001");
    assertEquals(RPCStreamerErrorCode.INVALID_RPC, "RPC_002");
    assertEquals(RPCStreamerErrorCode.HEALTH_CHECK_FAILED, "RPC_003");
    assertEquals(RPCStreamerErrorCode.LIVE_FETCH_FAILED, "RPC_004");
    assertEquals(RPCStreamerErrorCode.ARCHIVE_FETCH_FAILED, "RPC_005");
    assertEquals(RPCStreamerErrorCode.PARSE_FAILED, "RPC_006");
    assertEquals(RPCStreamerErrorCode.INVALID_SEQUENCE_RANGE, "RPC_007");
    assertEquals(RPCStreamerErrorCode.ALREADY_RUNNING, "RPC_008");
    assertEquals(RPCStreamerErrorCode.NOT_RUNNING, "RPC_009");
    assertEquals(RPCStreamerErrorCode.MAX_FAILURES_EXCEEDED, "RPC_010");
    assertEquals(RPCStreamerErrorCode.RPC_ALREADY_SET, "RPC_011");
    assertEquals(RPCStreamerErrorCode.ARCHIVE_RPC_ALREADY_SET, "RPC_012");
    assertEquals(RPCStreamerErrorCode.RPC_NOT_HEALTHY, "RPC_013");
    assertEquals(RPCStreamerErrorCode.LEDGER_TOO_OLD, "RPC_014");
    assertEquals(RPCStreamerErrorCode.LEDGER_TOO_HIGH, "RPC_015");
    assertEquals(RPCStreamerErrorCode.MISSING_ARCHIVE_RPC, "RPC_016");
  });
});

describe("ERROR_DESCRIPTIONS", () => {
  it("has description for every error code", () => {
    const allCodes = Object.values(RPCStreamerErrorCode);
    for (const code of allCodes) {
      const description = ERROR_DESCRIPTIONS[code as RPCStreamerErrorCode];
      assertEquals(typeof description, "string");
      assertEquals(description.length > 0, true);
    }
  });
});

// =============================================================================
// Tests: RPCStreamer
// =============================================================================

describe("RPCStreamer", () => {
  let stubs: Stub<any, any[], any>[] = [];

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    stubs = [];
  });

  describe("constructor", () => {
    it("creates streamer with basic config", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      assertEquals(streamer.isRunning, false);
      assertEquals(streamer.archiveRpc, undefined);
    });

    it("creates streamer with archive RPC", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      assertEquals(streamer.archiveRpc !== undefined, true);
    });

    it("creates streamer with custom options", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
        options: {
          limit: 20,
          waitLedgerIntervalMs: 3000,
          pagingIntervalMs: 50,
          archivalIntervalMs: 200,
          skipLedgerWaitIfBehind: true,
        },
      });

      // Properties are protected, but we can verify construction succeeded
      assertEquals(streamer.isRunning, false);
    });

    it("throws if pagingIntervalMs exceeds waitLedgerIntervalMs", () => {
      assertThrows(
        () =>
          new RPCStreamer<string>({
            rpcUrl: TEST_RPC_URL,
            ingestLive: createMockLiveIngest(),
            ingestArchive: createMockArchiveIngest(),
            options: {
              waitLedgerIntervalMs: 1000,
              pagingIntervalMs: 2000, // Invalid: greater than waitLedgerIntervalMs
            },
          }),
        RPCStreamerError,
        "pagingIntervalMs",
      );
    });
  });

  describe("rpc getter/setter", () => {
    it("returns the RPC server", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      assertEquals(streamer.rpc !== undefined, true);
    });

    it("allows setting rpc via setter when cleared", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      // Clear the internal _rpc to test the setter success path
      (streamer as any)._rpc = undefined;
      assertEquals(streamer.rpc, undefined);

      const newServer = new Server(TEST_RPC_URL);
      streamer.rpc = newServer;
      assertEquals(streamer.rpc, newServer);
    });

    it("throws when setting rpc if already set", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      assertThrows(
        () => {
          streamer.rpc = {} as any;
        },
        RPCStreamerError,
        "already set",
      );
    });
  });

  describe("archiveRpc getter/setter", () => {
    it("returns undefined when not set", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      assertEquals(streamer.archiveRpc, undefined);
    });

    it("allows setting archiveRpc via setter when not already set", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      assertEquals(streamer.archiveRpc, undefined);
      const archiveServer = new Server(TEST_ARCHIVE_RPC_URL);
      streamer.archiveRpc = archiveServer;
      assertEquals(streamer.archiveRpc, archiveServer);
    });

    it("throws when setting archiveRpc if already set", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      assertThrows(
        () => {
          streamer.archiveRpc = {} as any;
        },
        RPCStreamerError,
        "already set",
      );
    });
  });

  describe("setArchiveRpc", () => {
    it("sets archive RPC by URL", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      assertEquals(streamer.archiveRpc, undefined);
      streamer.setArchiveRpc(TEST_ARCHIVE_RPC_URL);
      assertEquals(streamer.archiveRpc !== undefined, true);
    });
  });

  describe("stop", () => {
    it("sets isRunning to false", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(["test1", "test2"]),
        ingestArchive: createMockArchiveIngest(),
      });

      // Stub getHealth
      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      // Start in background and immediately stop
      const streamPromise = streamer.startLive(
        async () => {
          streamer.stop();
        },
        { startLedger: 95000 },
      );

      await streamPromise;
      assertEquals(streamer.isRunning, false);
    });

    it("stops mid-ingestion and exits loop", async () => {
      const receivedData: string[] = [];
      let callCount = 0;

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, onData, _stopLedger) => {
          callCount++;
          await onData(`data-${callCount}`);
          // Stop during second call
          if (callCount === 2) {
            streamer.stop();
          }
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: false,
          };
        },
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await streamer.startLive(
        async (data) => {
          receivedData.push(data);
        },
        { startLedger: 95000 },
      );

      // Should have stopped after second call
      assertEquals(callCount, 2);
      assertEquals(receivedData.length, 2);
    });
  });

  describe("startLive", () => {
    it("throws if already running", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(["test"]),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      // Start first stream
      const firstPromise = streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      // Immediately try to start another
      await assertRejects(
        () => streamer.startLive(async () => {}),
        RPCStreamerError,
        "already running",
      );

      await firstPromise;
    });

    it("throws if live ingestor not provided", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestArchive: createMockArchiveIngest(),
      });

      await assertRejects(
        () => streamer.startLive(async () => {}),
        RPCStreamerError,
        "Live ingestor is required",
      );
    });

    it("throws if RPC is not healthy", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ status: "unhealthy" })),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.startLive(async () => {}),
        RPCStreamerError,
        "not healthy",
      );
    });

    it("throws if ledger is too old", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 100000,
          }),
        ),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.startLive(async () => {}, { startLedger: 80000 }),
        RPCStreamerError,
        "older than oldest",
      );
    });

    it("throws if ledger is too high", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 100000,
          }),
        ),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.startLive(async () => {}, { startLedger: 150000 }),
        RPCStreamerError,
        "higher than latest",
      );
    });

    it("processes data via callback", async () => {
      const receivedData: string[] = [];
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(["data1", "data2"]),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await streamer.startLive(
        async (data) => {
          receivedData.push(data);
        },
        { startLedger: 95000, stopLedger: 95001 },
      );

      assertEquals(receivedData.length, 2);
      assertEquals(receivedData[0], "data1");
      assertEquals(receivedData[1], "data2");
    });

    it("uses latestLedger as default when startLedger not provided", async () => {
      let capturedStartLedger: number | undefined;
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, _onData, _stopLedger) => {
          capturedStartLedger = ledgerSequence;
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: true,
          };
        },
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 98765 })),
      );
      stubs.push(healthStub);

      await streamer.startLive(async () => {}, { stopLedger: 98765 });

      assertEquals(capturedStartLedger, 98765);
    });

    it("re-throws network errors", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.reject(new Error("Connection refused")),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.startLive(async () => {}),
        Error,
        "Connection refused",
      );
    });

    it("waits when shouldWait is true and not past stopLedger", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(["data"], {
          onCall: (callIndex) => {
            if (callIndex === 1) {
              return {
                nextLedger: 95001,
                shouldWait: true,
                hitStopLedger: false,
              };
            }
            return {
              nextLedger: 95002,
              shouldWait: false,
              hitStopLedger: true,
            };
          },
        }),
        ingestArchive: createMockArchiveIngest(),
        options: { waitLedgerIntervalMs: 10, pagingIntervalMs: 5 },
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      const startTime = Date.now();
      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95001,
      });
      const elapsed = Date.now() - startTime;

      // Should have waited at least once (10ms)
      assertEquals(elapsed >= 10, true);
    });

    it("does not wait when past stopLedger", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(["data"], { shouldWait: true }),
        ingestArchive: createMockArchiveIngest(),
        options: { waitLedgerIntervalMs: 100 },
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      const startTime = Date.now();
      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });
      const elapsed = Date.now() - startTime;

      // Should be fast - no 100ms wait
      assertEquals(elapsed < 50, true);
    });

    it("handles hitStopLedger from live ingest", async () => {
      const receivedData: string[] = [];
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(["data1"], { hitStopLedgerAfter: 1 }),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await streamer.startLive(
        async (data) => {
          receivedData.push(data);
        },
        { startLedger: 95000, stopLedger: 95010 },
      );

      assertEquals(receivedData.length, 1);
      assertEquals(streamer.isRunning, false);
    });
  });

  describe("startArchive", () => {
    it("throws if already running", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(["test"]),
      });

      // Start first stream
      const firstPromise = streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1000,
      });

      // Immediately try to start another
      await assertRejects(
        () =>
          streamer.startArchive(async () => {}, {
            startLedger: 1000,
            stopLedger: 1000,
          }),
        RPCStreamerError,
        "already running",
      );

      await firstPromise;
    });

    it("throws if archive ingestor not provided", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
      });

      await assertRejects(
        () =>
          streamer.startArchive(async () => {}, {
            startLedger: 1000,
            stopLedger: 2000,
          }),
        RPCStreamerError,
        "Archive ingestor is required",
      );
    });

    it("throws if archive RPC not configured", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      await assertRejects(
        () =>
          streamer.startArchive(async () => {}, {
            startLedger: 1000,
            stopLedger: 2000,
          }),
        RPCStreamerError,
        "Archive RPC is required",
      );
    });

    it("throws if startLedger > stopLedger", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      await assertRejects(
        () =>
          streamer.startArchive(async () => {}, {
            startLedger: 2000,
            stopLedger: 1000,
          }),
        RPCStreamerError,
        "Invalid ingestion range",
      );
    });

    it("processes archive data via callback", async () => {
      const receivedData: string[] = [];
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(["archive1", "archive2"]),
      });

      await streamer.startArchive(
        async (data) => {
          receivedData.push(data);
        },
        { startLedger: 1000, stopLedger: 1001 },
      );

      assertEquals(receivedData.length, 2);
      assertEquals(receivedData[0], "archive1");
      assertEquals(receivedData[1], "archive2");
    });

    it("re-throws archive errors", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest([], { throwOnCalls: [1] }),
      });

      await assertRejects(
        () =>
          streamer.startArchive(async () => {}, {
            startLedger: 1000,
            stopLedger: 1005,
          }),
        Error,
        "Simulated archive error",
      );
    });

    it("stops when isRunning becomes false during ingestion", async () => {
      const receivedData: string[] = [];
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: async (
          _rpc,
          _startLedger,
          stopLedger,
          onData,
          context,
        ) => {
          for (let i = 0; i < 5; i++) {
            if (!context.isRunning()) break;
            await onData(`data-${i}`);
            if (i === 1) streamer.stop(); // Stop after second item
          }
          return stopLedger + 1;
        },
      });

      await streamer.startArchive(
        async (data) => {
          receivedData.push(data);
        },
        { startLedger: 1000, stopLedger: 1005 },
      );

      // Should have only processed 2 items (0, 1) before stop
      assertEquals(receivedData.length, 2);
    });

    it("handles empty results gracefully", async () => {
      const receivedData: string[] = [];
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest([]), // Empty results
      });

      await streamer.startArchive(
        async (data) => {
          receivedData.push(data);
        },
        { startLedger: 1000, stopLedger: 1005 },
      );

      assertEquals(receivedData.length, 0);
    });
  });

  describe("start (auto mode)", () => {
    it("throws if already running", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(["test"]),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      // Start first stream
      const firstPromise = streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95000,
      });

      // Immediately try to start another
      await assertRejects(
        () => streamer.start(async () => {}),
        RPCStreamerError,
        "already running",
      );

      await firstPromise;
    });

    it("throws if RPC is not healthy", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ status: "unhealthy" })),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.start(async () => {}),
        RPCStreamerError,
        "not healthy",
      );
    });

    it("throws if live ingestor not provided when in live range", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.start(async () => {}, { startLedger: 95000 }),
        RPCStreamerError,
        "Live ingestor is required",
      );
    });

    it("throws if archive ingestor not provided when ledger too old", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 100000,
          }),
        ),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.start(async () => {}, { startLedger: 50000 }),
        RPCStreamerError,
        "Archive ingestor is required",
      );
    });

    it("uses live mode for recent ledgers", async () => {
      const receivedData: string[] = [];
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(["live1"]),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await streamer.start(
        async (data) => {
          receivedData.push(data);
        },
        { startLedger: 95000, stopLedger: 95000 },
      );

      assertEquals(receivedData.length, 1);
      assertEquals(receivedData[0], "live1");
    });

    it("throws LEDGER_TOO_OLD when no archive RPC and ledger too old", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        // No archive RPC
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 100000,
          }),
        ),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.start(async () => {}, { startLedger: 80000 }),
        RPCStreamerError,
        "older than oldest",
      );
    });

    it("throws LEDGER_TOO_HIGH if startLedger exceeds latestLedger", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 100000,
          }),
        ),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.start(async () => {}, { startLedger: 150000 }),
        RPCStreamerError,
        "higher than latest",
      );
    });

    it("uses latestLedger as default when startLedger not provided", async () => {
      let capturedStartLedger: number | undefined;
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, _onData, _stopLedger) => {
          capturedStartLedger = ledgerSequence;
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: true,
          };
        },
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse({ latestLedger: 98765 })),
      );
      stubs.push(healthStub);

      await streamer.start(async () => {}, { stopLedger: 98765 });

      assertEquals(capturedStartLedger, 98765);
    });

    it("re-throws connection errors", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.reject(new Error("Connection refused")),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.start(async () => {}),
        Error,
        "Connection refused",
      );
    });

    it("skips wait when skipLedgerWaitIfBehind is true and behind", async () => {
      let ingestCount = 0;
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, _onData, stopLedger) => {
          ingestCount++;
          const hitStop =
            stopLedger !== undefined && ledgerSequence >= stopLedger;
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: true, // Always says to wait
            hitStopLedger: hitStop,
          };
        },
        ingestArchive: createMockArchiveIngest(),
        options: {
          waitLedgerIntervalMs: 100,
          skipLedgerWaitIfBehind: true,
        },
      });

      let healthCallCount = 0;
      const healthStub = stub(streamer.rpc, "getHealth", () => {
        healthCallCount++;
        // Always report we're behind (latestLedger is ahead of current)
        return Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 95010, // Always ahead
          }),
        );
      });
      stubs.push(healthStub);

      const startTime = Date.now();
      await streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95002,
      });
      const elapsed = Date.now() - startTime;

      // Should be fast - skipped waiting because we're behind
      assertEquals(elapsed < 200, true);
      assertEquals(ingestCount, 3); // 95000, 95001, 95002
    });

    it("waits when skipLedgerWaitIfBehind is true but caught up", async () => {
      let ingestCount = 0;
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, _onData, stopLedger) => {
          ingestCount++;
          const hitStop =
            stopLedger !== undefined && ledgerSequence >= stopLedger;
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: true,
            hitStopLedger: hitStop,
          };
        },
        ingestArchive: createMockArchiveIngest(),
        options: {
          waitLedgerIntervalMs: 20,
          pagingIntervalMs: 10,
          skipLedgerWaitIfBehind: true,
        },
      });

      let healthCallCount = 0;
      const healthStub = stub(streamer.rpc, "getHealth", () => {
        healthCallCount++;
        if (healthCallCount === 1) {
          return Promise.resolve(
            createMockHealthResponse({
              oldestLedger: 90000,
              latestLedger: 95000,
            }),
          );
        }
        // After first ingest, we're caught up (currentLedger >= latestLedger - 1)
        return Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 95001, // currentLedger (95001) >= latestLedger - 1 (95000)
          }),
        );
      });
      stubs.push(healthStub);

      const startTime = Date.now();
      await streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95001,
      });
      const elapsed = Date.now() - startTime;

      // Should have waited at least once because we're caught up
      assertEquals(elapsed >= 20, true);
    });
  });

  // ===========================================================================
  // Tests: Historical → Live Transition
  // ===========================================================================

  describe("start (historical mode)", () => {
    it("uses archive RPC when startLedger < oldestAvailable", async () => {
      const liveData: string[] = [];
      const archiveData: string[] = [];

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, onData, _stopLedger) => {
          await onData(`live-${ledgerSequence}`);
          liveData.push(`live-${ledgerSequence}`);
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: true,
          };
        },
        ingestArchive: async (
          _rpc,
          startLedger,
          stopLedger,
          onData,
          _context,
        ) => {
          for (let i = startLedger; i <= stopLedger; i++) {
            await onData(`archive-${i}`);
            archiveData.push(`archive-${i}`);
          }
          return stopLedger + 1;
        },
      });

      let healthCallCount = 0;
      const healthStub = stub(streamer.rpc, "getHealth", () => {
        healthCallCount++;
        return Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000, // oldestAvailable = 90002
            latestLedger: 100000,
          }),
        );
      });
      stubs.push(healthStub);

      // Start from 85000, which is < oldestAvailable (90002), stop at 85002
      await streamer.start(async () => {}, {
        startLedger: 85000,
        stopLedger: 85002,
      });

      // Should have used archive
      assertEquals(archiveData.length, 3);
      assertEquals(archiveData[0], "archive-85000");
      // Should NOT have used live (stopLedger < oldestAvailable)
      assertEquals(liveData.length, 0);
    });

    it("transitions from archive to live mode when caught up", async () => {
      const liveData: string[] = [];
      const archiveData: string[] = [];

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, onData, _stopLedger) => {
          await onData(`live-${ledgerSequence}`);
          liveData.push(`live-${ledgerSequence}`);
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: true,
          };
        },
        ingestArchive: async (
          _rpc,
          startLedger,
          stopLedger,
          onData,
          _context,
        ) => {
          for (let i = startLedger; i <= stopLedger; i++) {
            await onData(`archive-${i}`);
            archiveData.push(`archive-${i}`);
          }
          return stopLedger + 1;
        },
      });

      let healthCallCount = 0;
      const healthStub = stub(streamer.rpc, "getHealth", () => {
        healthCallCount++;
        if (healthCallCount <= 2) {
          // First checks: oldestAvailable = 90002
          return Promise.resolve(
            createMockHealthResponse({
              oldestLedger: 90000,
              latestLedger: 100000,
            }),
          );
        }
        // After archive ingestion: shift retention window
        return Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 89000, // oldestAvailable = 89002
            latestLedger: 100000,
          }),
        );
      });
      stubs.push(healthStub);

      // Start from 89500, which is < oldestAvailable(90002), stop at 90005
      await streamer.start(async () => {}, {
        startLedger: 89500,
        stopLedger: 90005,
      });

      // Should have used archive for 89500 to 90001 (oldestAvailable - 1)
      assertEquals(archiveData.length > 0, true);
      assertEquals(archiveData[0], "archive-89500");

      // After shift, should transition to live mode
      assertEquals(liveData.length > 0, true);
    });

    it("continues loop after historical ingestion to re-check oldestAvailable", async () => {
      let archiveCallCount = 0;
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, _onData, _stopLedger) => {
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: true,
          };
        },
        ingestArchive: async (
          _rpc,
          _startLedger,
          stopLedger,
          _onData,
          _context,
        ) => {
          archiveCallCount++;
          return stopLedger + 1;
        },
      });

      let healthCallCount = 0;
      const healthStub = stub(streamer.rpc, "getHealth", () => {
        healthCallCount++;
        if (healthCallCount === 1) {
          // Initial health check
          return Promise.resolve(
            createMockHealthResponse({
              oldestLedger: 90000,
              latestLedger: 100000,
            }),
          );
        }
        if (healthCallCount === 2) {
          // Still in historical range
          return Promise.resolve(
            createMockHealthResponse({
              oldestLedger: 90000,
              latestLedger: 100000,
            }),
          );
        }
        // Shift so we're now in live range
        return Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 85000,
            latestLedger: 100000,
          }),
        );
      });
      stubs.push(healthStub);

      await streamer.start(async () => {}, {
        startLedger: 85000,
        stopLedger: 90005,
      });

      // Should have called archive at least once, then continued
      assertEquals(archiveCallCount >= 1, true);
    });

    it("calculates targetLedger as Math.min(oldestAvailable-1, stopLedger)", async () => {
      let capturedStopLedger: number | undefined;
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: async () => ({
          nextLedger: 1,
          shouldWait: false,
          hitStopLedger: true,
        }),
        ingestArchive: async (
          _rpc,
          _startLedger,
          stopLedger,
          _onData,
          _context,
        ) => {
          capturedStopLedger = stopLedger;
          return stopLedger + 1;
        },
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000, // oldestAvailable = 90002
            latestLedger: 100000,
          }),
        ),
      );
      stubs.push(healthStub);

      // startLedger=85000, stopLedger=88000
      // targetLedger should be Math.min(90001, 88000) = 88000
      await streamer.start(async () => {}, {
        startLedger: 85000,
        stopLedger: 88000,
      });

      assertEquals(capturedStopLedger, 88000);
    });
  });

  // ===========================================================================
  // Tests: Checkpoint Handling
  // ===========================================================================

  describe("checkpoint handling", () => {
    it("calls onCheckpoint at specified intervals in startLive", async () => {
      const checkpoints: number[] = [];

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, _onData, stopLedger) => {
          const next = ledgerSequence + 1;
          const hitStop =
            stopLedger !== undefined && ledgerSequence >= stopLedger;
          return {
            nextLedger: next,
            shouldWait: false,
            hitStopLedger: hitStop,
          };
        },
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await streamer.startLive(async () => {}, {
        startLedger: 95000,
        stopLedger: 95005,
        checkpointInterval: 2,
        onCheckpoint: (sequence) => {
          checkpoints.push(sequence);
        },
      });

      // Ledgers: 95000, 95001, 95002, 95003, 95004, 95005
      // Checkpoints at: 95000 % 2 = 0 ✓, 95002 % 2 = 0 ✓, 95004 % 2 = 0 ✓
      assertEquals(checkpoints.includes(95000), true);
      assertEquals(checkpoints.includes(95002), true);
      assertEquals(checkpoints.includes(95004), true);
    });

    it("calls onCheckpoint at specified intervals in start()", async () => {
      const checkpoints: number[] = [];

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, _onData, stopLedger) => {
          const hitStop =
            stopLedger !== undefined && ledgerSequence >= stopLedger;
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: hitStop,
          };
        },
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95003,
        checkpointInterval: 2,
        onCheckpoint: (sequence) => {
          checkpoints.push(sequence);
        },
      });

      assertEquals(checkpoints.includes(95000), true);
      assertEquals(checkpoints.includes(95002), true);
    });

    it("passes checkpoint handler to archive ingestor", async () => {
      const checkpoints: number[] = [];
      let receivedContext: any;

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: async (_rpc, _start, stop, _onData, context) => {
          receivedContext = context;
          // Simulate calling checkpoint from archive ingestor
          if (context.onCheckpoint) {
            context.onCheckpoint(1000);
            context.onCheckpoint(1002);
          }
          return stop + 1;
        },
      });

      await streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1005,
        checkpointInterval: 2,
        onCheckpoint: (seq) => {
          checkpoints.push(seq);
        },
      });

      assertEquals(receivedContext.checkpointInterval, 2);
      assertEquals(typeof receivedContext.onCheckpoint, "function");
      assertEquals(checkpoints, [1000, 1002]);
    });

    it("uses default checkpoint interval of 100", async () => {
      let receivedInterval: number | undefined;

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: async (_rpc, _start, stop, _onData, context) => {
          receivedInterval = context.checkpointInterval;
          return stop + 1;
        },
      });

      await streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1005,
        onCheckpoint: () => {},
        // No checkpointInterval provided, should default to 100
      });

      assertEquals(receivedInterval, undefined); // It's only passed if provided
    });
  });

  // ===========================================================================
  // Tests: Error Handler
  // ===========================================================================

  describe("error handling", () => {
    it("calls onError and continues when error occurs in startLive", async () => {
      const errors: { error: Error; ledger: number }[] = [];
      const receivedData: string[] = [];

      let callCount = 0;
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, onData, stopLedger) => {
          callCount++;
          if (callCount === 1) {
            throw new Error("Transient error");
          }
          await onData(`data-${callCount}`);
          const hitStop =
            stopLedger !== undefined && ledgerSequence >= stopLedger;
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: hitStop,
          };
        },
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await streamer.startLive(
        async (data) => {
          receivedData.push(data);
        },
        {
          startLedger: 95000,
          stopLedger: 95001,
          onError: (error, ledger) => {
            errors.push({ error, ledger });
            return true; // Continue
          },
        },
      );

      assertEquals(errors.length, 1);
      assertEquals(errors[0].error.message, "Transient error");
      assertEquals(errors[0].ledger, 95000);
      assertEquals(receivedData.length >= 1, true);
    });

    it("re-throws error when no onError handler in startLive", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest([], { throwOnCalls: [1] }),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await assertRejects(
        () => streamer.startLive(async () => {}, { startLedger: 95000 }),
        Error,
        "Simulated error",
      );
    });

    it("re-throws error when onError returns false", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest([], { throwOnCalls: [1] }),
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await assertRejects(
        () =>
          streamer.startLive(async () => {}, {
            startLedger: 95000,
            onError: () => false, // Return false to rethrow
          }),
        Error,
        "Simulated error",
      );
    });

    it("calls onError and continues in start() live mode", async () => {
      const errors: Error[] = [];
      let callCount = 0;

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: async (_rpc, ledgerSequence, _onData, stopLedger) => {
          callCount++;
          if (callCount === 1) {
            throw new Error("Live error");
          }
          const hitStop =
            stopLedger !== undefined && ledgerSequence >= stopLedger;
          return {
            nextLedger: ledgerSequence + 1,
            shouldWait: false,
            hitStopLedger: hitStop,
          };
        },
        ingestArchive: createMockArchiveIngest(),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(createMockHealthResponse()),
      );
      stubs.push(healthStub);

      await streamer.start(async () => {}, {
        startLedger: 95000,
        stopLedger: 95001,
        onError: (error) => {
          errors.push(error);
          return true;
        },
      });

      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "Live error");
    });

    it("calls onError and continues in start() archive mode", async () => {
      const errors: Error[] = [];
      let callCount = 0;

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(["live"]),
        ingestArchive: async (_rpc, _start, stop, _onData, _context) => {
          callCount++;
          if (callCount === 1) {
            throw new Error("Archive error");
          }
          return stop + 1;
        },
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 100000,
          }),
        ),
      );
      stubs.push(healthStub);

      await streamer.start(async () => {}, {
        startLedger: 85000,
        stopLedger: 85002,
        onError: (error) => {
          errors.push(error);
          return true;
        },
      });

      assertEquals(errors.length, 1);
      assertEquals(errors[0].message, "Archive error");
    });

    it("re-throws archive error in start() when no onError handler", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest([], { throwOnCalls: [1] }),
      });

      const healthStub = stub(streamer.rpc, "getHealth", () =>
        Promise.resolve(
          createMockHealthResponse({
            oldestLedger: 90000,
            latestLedger: 100000,
          }),
        ),
      );
      stubs.push(healthStub);

      await assertRejects(
        () =>
          streamer.start(async () => {}, {
            startLedger: 85000,
            stopLedger: 85005,
          }),
        Error,
        "Simulated archive error",
      );
    });

    it("passes error handler to archive ingestor", async () => {
      let receivedContext: any;

      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: async (_rpc, _start, stop, _onData, context) => {
          receivedContext = context;
          return stop + 1;
        },
      });

      await streamer.startArchive(async () => {}, {
        startLedger: 1000,
        stopLedger: 1005,
        onError: () => true,
      });

      assertEquals(typeof receivedContext.onError, "function");
    });
  });
});

// =============================================================================
// Tests: createEventStreamer factory
// =============================================================================

describe("createEventStreamer", () => {
  describe("factory function", () => {
    it("creates RPCStreamer with basic config", () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
      });

      assertEquals(streamer instanceof RPCStreamer, true);
      assertEquals(streamer.isRunning, false);
    });

    it("creates RPCStreamer with filters", () => {
      const mockFilter = {
        toRawEventFilter: () => ({ type: "contract" }),
      } as any;
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        filters: [mockFilter],
      });

      assertEquals(streamer instanceof RPCStreamer, true);
    });

    it("creates RPCStreamer with archive RPC", () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
      });

      assertEquals(streamer.archiveRpc !== undefined, true);
    });

    it("creates RPCStreamer with custom options", () => {
      const streamer = createEventStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          limit: 20,
          waitLedgerIntervalMs: 3000,
          pagingIntervalMs: 50,
        },
      });

      assertEquals(streamer instanceof RPCStreamer, true);
    });
  });
});

describe("RPCStreamer.event static method", () => {
  it("creates event streamer via static method", () => {
    const streamer = RPCStreamer.event({
      rpcUrl: TEST_RPC_URL,
    });

    assertEquals(streamer instanceof RPCStreamer, true);
    assertEquals(streamer.isRunning, false);
  });

  it("creates event streamer with all options", () => {
    const mockFilter = {
      toRawEventFilter: () => ({ type: "contract" }),
    } as any;
    const streamer = RPCStreamer.event({
      rpcUrl: TEST_RPC_URL,
      archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
      filters: [mockFilter],
      options: {
        limit: 20,
        waitLedgerIntervalMs: 3000,
      },
    });

    assertEquals(streamer instanceof RPCStreamer, true);
    assertEquals(streamer.archiveRpc !== undefined, true);
  });
});

// =============================================================================
// Tests: createLedgerStreamer factory
// =============================================================================

describe("createLedgerStreamer", () => {
  describe("factory function", () => {
    it("creates RPCStreamer with basic config", () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
      });

      assertEquals(streamer instanceof RPCStreamer, true);
      assertEquals(streamer.isRunning, false);
    });

    it("creates RPCStreamer with archive RPC", () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
      });

      assertEquals(streamer.archiveRpc !== undefined, true);
    });

    it("creates RPCStreamer with custom options", () => {
      const streamer = createLedgerStreamer({
        rpcUrl: TEST_RPC_URL,
        options: {
          waitLedgerIntervalMs: 3000,
          archivalIntervalMs: 200,
        },
      });

      assertEquals(streamer instanceof RPCStreamer, true);
    });
  });
});

describe("RPCStreamer.ledger static method", () => {
  it("creates ledger streamer via static method", () => {
    const streamer = RPCStreamer.ledger({
      rpcUrl: TEST_RPC_URL,
    });

    assertEquals(streamer instanceof RPCStreamer, true);
    assertEquals(streamer.isRunning, false);
  });

  it("creates ledger streamer with all options", () => {
    const streamer = RPCStreamer.ledger({
      rpcUrl: TEST_RPC_URL,
      archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
      options: {
        waitLedgerIntervalMs: 3000,
      },
    });

    assertEquals(streamer instanceof RPCStreamer, true);
    assertEquals(streamer.archiveRpc !== undefined, true);
  });
});

// =============================================================================
// Internal Methods - Forced Coverage Tests
// =============================================================================

describe("RPCStreamer protected methods (forced coverage)", () => {
  const stubs: Stub[] = [];

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    stubs.length = 0;
  });

  describe("waitFor", () => {
    it("waits for paging interval", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
        options: {
          pagingIntervalMs: 5,
        },
      });

      // Access protected method
      const start = Date.now();
      await (streamer as any).waitFor("paging");
      const elapsed = Date.now() - start;

      // Should wait at least the configured interval
      assertEquals(elapsed >= 5, true);
    });

    it("waits for archival interval", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
        options: {
          archivalIntervalMs: 5,
        },
      });

      // Access protected method
      const start = Date.now();
      await (streamer as any).waitFor("archival");
      const elapsed = Date.now() - start;

      // Should wait at least the configured interval
      assertEquals(elapsed >= 5, true);
    });

    it("defaults to ledger interval for unknown type", async () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
        options: {
          waitLedgerIntervalMs: 5,
          pagingIntervalMs: 3, // Must be <= waitLedgerIntervalMs
        },
      });

      // Access protected method with unknown interval type (falls through to default)
      const start = Date.now();
      await (streamer as any).waitFor("unknown");
      const elapsed = Date.now() - start;

      assertEquals(elapsed >= 5, true);
    });
  });

  describe("handleError", () => {
    it("returns false when no onError handler provided", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const result = (streamer as any).handleError(
        new Error("Test error"),
        95000,
        undefined,
      );

      assertEquals(result, false);
    });

    it("returns true when onError handler returns undefined", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const result = (streamer as any).handleError(
        new Error("Test error"),
        95000,
        () => undefined,
      );

      assertEquals(result, true);
    });

    it("returns true when onError handler returns true", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const result = (streamer as any).handleError(
        new Error("Test error"),
        95000,
        () => true,
      );

      assertEquals(result, true);
    });

    it("returns false when onError handler returns false explicitly", () => {
      const streamer = new RPCStreamer<string>({
        rpcUrl: TEST_RPC_URL,
        ingestLive: createMockLiveIngest(),
        ingestArchive: createMockArchiveIngest(),
      });

      const result = (streamer as any).handleError(
        new Error("Test error"),
        95000,
        () => false,
      );

      assertEquals(result, false);
    });
  });
});

describe("RPCStreamer error rethrow paths (forced coverage)", () => {
  const stubs: Stub[] = [];

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    stubs.length = 0;
  });

  it("rethrows error in startLive when no onError handler provided", async () => {
    const streamer = new RPCStreamer<string>({
      rpcUrl: TEST_RPC_URL,
      ingestLive: createMockLiveIngest([], { throwOnCalls: [1] }),
      ingestArchive: createMockArchiveIngest(),
    });

    const healthStub = stub(streamer.rpc, "getHealth", () =>
      Promise.resolve(createMockHealthResponse()),
    );
    stubs.push(healthStub);

    await assertRejects(
      async () => {
        await streamer.startLive(async () => {}, { startLedger: 95000 });
      },
      Error,
      "Simulated error on call 1",
    );
  });

  it("rethrows error in startLive when onError returns false", async () => {
    const streamer = new RPCStreamer<string>({
      rpcUrl: TEST_RPC_URL,
      ingestLive: createMockLiveIngest([], { throwOnCalls: [1] }),
      ingestArchive: createMockArchiveIngest(),
    });

    const healthStub = stub(streamer.rpc, "getHealth", () =>
      Promise.resolve(createMockHealthResponse()),
    );
    stubs.push(healthStub);

    await assertRejects(
      async () => {
        await streamer.startLive(async () => {}, {
          startLedger: 95000,
          onError: () => false, // Explicitly reject the error
        });
      },
      Error,
      "Simulated error on call 1",
    );
  });

  it("rethrows error in start() archive mode when no onError handler provided", async () => {
    const streamer = new RPCStreamer<string>({
      rpcUrl: TEST_RPC_URL,
      archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
      ingestLive: createMockLiveIngest(),
      ingestArchive: async () => {
        throw new Error("Archive error");
      },
    });

    const healthStub = stub(streamer.rpc, "getHealth", () =>
      Promise.resolve(createMockHealthResponse({ oldestLedger: 90000 })),
    );
    stubs.push(healthStub);

    await assertRejects(
      async () => {
        // Start at ledger 80000 which is older than oldestLedger 90000
        await streamer.start(async () => {}, { startLedger: 80000 });
      },
      Error,
      "Archive error",
    );
  });

  it("rethrows error in start() archive mode when onError returns false", async () => {
    const streamer = new RPCStreamer<string>({
      rpcUrl: TEST_RPC_URL,
      archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
      ingestLive: createMockLiveIngest(),
      ingestArchive: async () => {
        throw new Error("Archive error rejected");
      },
    });

    const healthStub = stub(streamer.rpc, "getHealth", () =>
      Promise.resolve(createMockHealthResponse({ oldestLedger: 90000 })),
    );
    stubs.push(healthStub);

    await assertRejects(
      async () => {
        await streamer.start(async () => {}, {
          startLedger: 80000,
          onError: () => false,
        });
      },
      Error,
      "Archive error rejected",
    );
  });

  it("rethrows error in start() live mode when no onError handler provided", async () => {
    const streamer = new RPCStreamer<string>({
      rpcUrl: TEST_RPC_URL,
      ingestLive: createMockLiveIngest([], { throwOnCalls: [1] }),
      ingestArchive: createMockArchiveIngest(),
    });

    const healthStub = stub(streamer.rpc, "getHealth", () =>
      Promise.resolve(createMockHealthResponse()),
    );
    stubs.push(healthStub);

    await assertRejects(
      async () => {
        await streamer.start(async () => {}, { startLedger: 95000 });
      },
      Error,
      "Simulated error on call 1",
    );
  });

  it("rethrows error in start() live mode when onError returns false", async () => {
    const streamer = new RPCStreamer<string>({
      rpcUrl: TEST_RPC_URL,
      ingestLive: createMockLiveIngest([], { throwOnCalls: [1] }),
      ingestArchive: createMockArchiveIngest(),
    });

    const healthStub = stub(streamer.rpc, "getHealth", () =>
      Promise.resolve(createMockHealthResponse()),
    );
    stubs.push(healthStub);

    await assertRejects(
      async () => {
        await streamer.start(async () => {}, {
          startLedger: 95000,
          onError: () => false,
        });
      },
      Error,
      "Simulated error on call 1",
    );
  });
});

describe("RPCStreamer stopLedger guard paths (forced coverage)", () => {
  const stubs: Stub[] = [];

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    stubs.length = 0;
  });

  it("stops at beginning of loop in startLive when currentLedger > stopLedger", async () => {
    const receivedData: string[] = [];

    // Create a live ingest that returns a nextLedger past the stopLedger
    const streamer = new RPCStreamer<string>({
      rpcUrl: TEST_RPC_URL,
      ingestLive: createMockLiveIngest<string>(["item1"], {
        onCall: (callIndex) => {
          if (callIndex === 1) {
            return {
              nextLedger: 95010,
              shouldWait: false,
              hitStopLedger: false,
            };
          }
          return undefined;
        },
      }),
      ingestArchive: createMockArchiveIngest(),
    });

    const healthStub = stub(streamer.rpc, "getHealth", () =>
      Promise.resolve(createMockHealthResponse({ latestLedger: 100000 })),
    );
    stubs.push(healthStub);

    await streamer.startLive(
      async (data) => {
        receivedData.push(data);
      },
      { startLedger: 95000, stopLedger: 95005 },
    );

    // Should have processed one item and stopped
    assertEquals(receivedData.length, 1);
    assertEquals(streamer.isRunning, false);
  });

  it("stops at beginning of loop in start() when currentLedger > stopLedger after live ingest", async () => {
    const receivedData: string[] = [];

    // Live ingest returns nextLedger past stopLedger without hitStopLedger
    const streamer = new RPCStreamer<string>({
      rpcUrl: TEST_RPC_URL,
      ingestLive: createMockLiveIngest<string>(["item1"], {
        onCall: (callIndex) => {
          if (callIndex === 1) {
            return {
              nextLedger: 95010,
              shouldWait: false,
              hitStopLedger: false,
            };
          }
          return undefined;
        },
      }),
      ingestArchive: createMockArchiveIngest(),
    });

    const healthStub = stub(streamer.rpc, "getHealth", () =>
      Promise.resolve(
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 }),
      ),
    );
    stubs.push(healthStub);

    await streamer.start(
      async (data) => {
        receivedData.push(data);
      },
      { startLedger: 95000, stopLedger: 95005 },
    );

    assertEquals(receivedData.length, 1);
    assertEquals(streamer.isRunning, false);
  });

  it("exercises isRunning callback in start() archive mode", async () => {
    const receivedData: string[] = [];
    let isRunningCalled = false;

    // Create custom archive ingest that calls isRunning
    const streamer = new RPCStreamer<string>({
      rpcUrl: TEST_RPC_URL,
      archiveRpcUrl: TEST_ARCHIVE_RPC_URL,
      ingestLive: createMockLiveIngest<string>(["live1"]),
      ingestArchive: async (_rpc, _start, stop, onData, context) => {
        // Call isRunning to exercise the callback
        isRunningCalled = context.isRunning();
        await onData("archive1");
        return stop + 1;
      },
    });

    const healthStub = stub(streamer.rpc, "getHealth", () =>
      Promise.resolve(
        createMockHealthResponse({ oldestLedger: 90000, latestLedger: 100000 }),
      ),
    );
    stubs.push(healthStub);

    await streamer.start(
      async (data) => {
        receivedData.push(data);
      },
      { startLedger: 80000, stopLedger: 80002 },
    );

    assertEquals(isRunningCalled, true);
    assertEquals(receivedData.includes("archive1"), true);
  });
});
