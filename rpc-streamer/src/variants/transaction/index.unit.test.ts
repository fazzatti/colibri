import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
} from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Ledger, NetworkConfig } from "@colibri/core";
import { Server } from "stellar-sdk/rpc";
import { loadLedgerFixtures } from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";
import { RPCStreamer } from "@/streamer.ts";
import { createTransactionStreamer } from "@/variants/transaction/index.ts";
import { createOperationStreamer } from "@/variants/operation/index.ts";
import { transactionRecords } from "@/variants/transaction/records.ts";
import { operationRecords } from "@/variants/operation/records.ts";
import {
  createArchiveItemIngestor,
  createLiveItemIngestor,
  deliverLedgerItems,
} from "@/variants/transaction/ledger-items.ts";
import type { StreamedTransaction } from "@/variants/transaction/types.ts";
import type { StreamedOperation } from "@/variants/operation/types.ts";
import { RPCStreamerError, RPCStreamerErrorCode } from "@/errors.ts";

const fixtures = loadLedgerFixtures();
const first = fixtures[2];
const last = fixtures[3];

describe("Transaction and operation ledger projections", () => {
  it("preserves every recorded ledger transaction and operation across metadata versions", () => {
    let failed = 0;
    for (const fixture of fixtures) {
      const ledger = Ledger.fromEntry(fixture);
      const transactions = transactionRecords(ledger);
      assertEquals(transactions.length, ledger.transactionCount);
      for (const [index, record] of transactions.entries()) {
        assertEquals(record.transaction, ledger.transactions[index]);
        assertEquals(record.transactionIndex, index);
        assertEquals(record.transactionHash, ledger.transactions[index].hash);
        assertEquals(record.ledgerSequence, ledger.sequence);
        assertEquals(record.ledgerHash, ledger.hash);
        assertEquals(record.ledgerCloseTime, ledger.ledgerCloseTime);
        assertEquals(
          record.transactionStatus,
          record.transaction.successful ? "success" : "failed",
        );
        if (record.transactionStatus === "failed") failed++;
      }
      const operations = operationRecords(ledger);
      assertEquals(
        operations.length,
        ledger.transactions.reduce((sum, tx) => sum + tx.operationCount, 0),
      );
      for (const record of operations) {
        assertEquals(
          record.parsedOperation,
          record.transaction.operations[record.operationIndex],
        );
        assertEquals(record.operation, record.parsedOperation.toOperation());
      }
    }
    assert(
      failed > 0,
      "The historical fixtures must exercise failed transaction delivery",
    );
  });

  it("acknowledges only fully delivered items, with optional cancellation context", async () => {
    const received: number[] = [];
    assertEquals(
      await deliverLedgerItems([1, 2], (value) => {
        received.push(value);
      }),
      true,
    );
    assertEquals(received, [1, 2]);
    assertEquals(await deliverLedgerItems([], () => {}), true);
    let running = true;
    assertEquals(
      await deliverLedgerItems([1, 2], () => {
        running = false;
      }, { isRunning: () => running }),
      false,
    );
    running = true;
    assertEquals(
      await deliverLedgerItems([1], () => {
        running = false;
      }, { isRunning: () => running }),
      true,
    );
    const failure = new Error("Consumer persistence failed");
    assertEquals(
      await assertRejects(() =>
        deliverLedgerItems([1], () => {
          throw failure;
        })
      ),
      failure,
    );
  });
});

// This is an offline recorded-XDR transport test, not a simulated Stellar ledger.
// A real SDK Server sends JSON-RPC over HTTP and decodes immutable RPC fixtures.
// Production methods and SDK decoding are never replaced with spies or stubs.
describe("Transaction and operation streaming over recorded RPC transport", () => {
  let server: Deno.HttpServer<Deno.NetAddr>;
  let rpc: Server;
  let abortOnRequest: AbortController | undefined;

  beforeAll(() => {
    server = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen: () => {} },
      async (request) => {
        const body = await request.json();
        abortOnRequest?.abort();
        const sequence = body.params?.startLedger;
        const entry = fixtures.find((fixture) => fixture.sequence >= sequence);
        const result = body.method === "getHealth"
          ? {
            status: "healthy",
            oldestLedger: first.sequence - 2,
            latestLedger: last.sequence,
            ledgerRetentionWindow: 100,
          }
          : {
            ledgers: entry ? [entry] : [],
            latestLedger: last.sequence,
            latestLedgerCloseTime: last.ledgerCloseTime,
            oldestLedger: first.sequence,
            oldestLedgerCloseTime: first.ledgerCloseTime,
            cursor: String(sequence),
          };
        return Response.json({ jsonrpc: "2.0", id: body.id, result });
      },
    );
    rpc = new Server(`http://127.0.0.1:${server.addr.port}`, {
      allowHttp: true,
    });
  });
  afterAll(async () => {
    await server.shutdown();
  });

  it("accepts native Server, NetworkConfig and URL factory paths", () => {
    const config = NetworkConfig.CustomNet({
      networkPassphrase: "fixture transport",
      rpcUrl: rpc.serverURL.toString(),
      allowHttp: true,
    });
    assertEquals(createTransactionStreamer({ rpc, archiveRpc: rpc }).rpc, rpc);
    assertEquals(
      createOperationStreamer({ rpc, archiveRpc: rpc }).archiveRpc,
      rpc,
    );
    assertEquals(
      RPCStreamer.transaction({
        networkConfig: config,
        options: { archivalIntervalMs: 0 },
      }).rpc.serverURL.toString(),
      rpc.serverURL.toString(),
    );
    assertEquals(
      RPCStreamer.operation({
        rpcUrl: rpc.serverURL.toString(),
        allowHttp: true,
        options: { archivalIntervalMs: 0 },
      }).rpc.serverURL.toString(),
      rpc.serverURL.toString(),
    );
  });

  it("streams transactions in live and auto mode with completed ledger checkpoints", async () => {
    const streamer = RPCStreamer.transaction({
      rpc,
      options: { pagingIntervalMs: 0, waitLedgerIntervalMs: 0 },
    });
    const records: StreamedTransaction[] = [];
    const checkpoints: number[] = [];
    await streamer.startLive((record) => {
      records.push(record);
    }, {
      startLedger: first.sequence,
      stopLedger: first.sequence,
      checkpointInterval: 1,
      onCheckpoint: (ledger) => {
        checkpoints.push(ledger);
      },
    });
    assertEquals(
      records.map((record) => record.transactionHash),
      transactionRecords(Ledger.fromEntry(first)).map((record) =>
        record.transactionHash
      ),
    );
    assertEquals(checkpoints, [first.sequence]);
    assertEquals(streamer.nextLedger, first.sequence + 1);
    const latest: StreamedTransaction[] = [];
    await streamer.start((record) => {
      latest.push(record);
    }, { stopLedger: last.sequence });
    assertEquals(latest.length, Ledger.fromEntry(last).transactionCount);
    assertEquals(streamer.nextLedger, last.sequence + 1);
  });

  it("replays partially delivered transaction ledgers on resume without checkpointing early", async () => {
    const streamer = RPCStreamer.transaction({
      rpc,
      options: { pagingIntervalMs: 0, waitLedgerIntervalMs: 0 },
    });
    const checkpoints: number[] = [];
    const partial: string[] = [];
    await streamer.startLive((record) => {
      partial.push(record.transactionHash);
      streamer.stop();
    }, {
      startLedger: first.sequence,
      stopLedger: first.sequence,
      checkpointInterval: 1,
      onCheckpoint: (ledger) => {
        checkpoints.push(ledger);
      },
    });
    assertEquals(partial.length, 1);
    assertEquals(streamer.nextLedger, first.sequence);
    assertEquals(checkpoints, []);
    const resumed: string[] = [];
    await streamer.startLive((record) => {
      resumed.push(record.transactionHash);
    }, { startLedger: streamer.nextLedger, stopLedger: first.sequence });
    assertEquals(resumed[0], partial[0]);
    assertEquals(resumed.length, Ledger.fromEntry(first).transactionCount);
  });

  it("stops between operation callbacks and acknowledges a stop in the final callback", async () => {
    const streamer = RPCStreamer.operation({
      rpc,
      archiveRpc: rpc,
      options: {
        archivalIntervalMs: 0,
        pagingIntervalMs: 0,
        waitLedgerIntervalMs: 0,
      },
    });
    const expected = operationRecords(Ledger.fromEntry(first));
    const checkpoints: number[] = [];
    const partial: StreamedOperation[] = [];
    await streamer.startArchive((record) => {
      partial.push(record);
      streamer.stop();
    }, {
      startLedger: first.sequence,
      stopLedger: first.sequence,
      checkpointInterval: 1,
      onCheckpoint: (ledger) => {
        checkpoints.push(ledger);
      },
    });
    assertEquals(partial.length, 1);
    assertEquals(streamer.nextLedger, first.sequence);
    assertEquals(checkpoints, []);
    const resumed: StreamedOperation[] = [];
    await streamer.startArchive((record) => {
      resumed.push(record);
      if (resumed.length === expected.length) streamer.stop();
    }, {
      startLedger: streamer.nextLedger!,
      stopLedger: first.sequence,
      checkpointInterval: 1,
      onCheckpoint: async (ledger) => {
        await Promise.resolve();
        checkpoints.push(ledger);
      },
    });
    assertEquals(resumed.length, expected.length);
    assertEquals(resumed[0].operation, partial[0].operation);
    assertEquals(checkpoints, [first.sequence]);
    assertEquals(streamer.nextLedger, first.sequence + 1);
    const live: StreamedOperation[] = [];
    await streamer.startLive((record) => {
      live.push(record);
    }, { startLedger: first.sequence, stopLedger: first.sequence });
    assertEquals(live.length, expected.length);
  });

  it("preserves handler failures and explicit archive skip policy", async () => {
    const streamer = RPCStreamer.transaction({
      rpc,
      archiveRpc: rpc,
      options: { archivalIntervalMs: 0 },
    });
    const failure = new Error("Consumer rejected ledger data");
    assertEquals(
      await assertRejects(() =>
        streamer.startArchive(() => {
          throw failure;
        }, {
          startLedger: first.sequence,
          stopLedger: first.sequence,
        })
      ),
      failure,
    );
    const skipped: number[] = [];
    await streamer.startArchive(() => {
      throw failure;
    }, {
      startLedger: first.sequence,
      stopLedger: first.sequence,
      onError: (error, ledger) => {
        assertEquals(error, failure);
        skipped.push(ledger);
        return true;
      },
    });
    assertEquals(skipped, [first.sequence]);
    const checkpoints: number[] = [];
    const error = await assertRejects(() =>
      streamer.startArchive(() => {}, {
        startLedger: first.sequence,
        stopLedger: first.sequence,
        checkpointInterval: 1,
        onCheckpoint: () => {
          throw failure;
        },
        onError: (_error, ledger) => {
          checkpoints.push(ledger);
          return true;
        },
      })
    );
    assertInstanceOf(error, RPCStreamerError);
    assertEquals(error.code, RPCStreamerErrorCode.CHECKPOINT_FAILED);
    assertEquals(checkpoints, []);
  });

  it("does not deliver out-of-bound, unavailable, or cancelled fetches", async () => {
    const ingest = createLiveItemIngestor(transactionRecords);
    const none = () => {
      throw new Error("Unexpected item delivery");
    };
    assertEquals(await ingest(rpc, last.sequence + 1, none), {
      nextLedger: last.sequence + 1,
      shouldWait: true,
      hitStopLedger: false,
    });
    assertEquals(await ingest(rpc, first.sequence, none, first.sequence - 1), {
      nextLedger: first.sequence,
      shouldWait: false,
      hitStopLedger: true,
    });
    const controller = new AbortController();
    abortOnRequest = controller;
    try {
      assertEquals(
        await ingest(rpc, first.sequence, none, undefined, {
          isRunning: () => !controller.signal.aborted,
        }),
        { nextLedger: first.sequence, shouldWait: false, hitStopLedger: false },
      );
    } finally {
      abortOnRequest = undefined;
    }
    const archive = createArchiveItemIngestor(transactionRecords, 0);
    assertEquals(
      await archive(rpc, last.sequence + 1, last.sequence + 1, none, {
        isRunning: () => true,
      }),
      last.sequence + 2,
    );
    assertEquals(
      await archive(rpc, first.sequence - 1, first.sequence - 1, none, {
        isRunning: () => true,
      }),
      first.sequence,
    );
    const archiveController = new AbortController();
    abortOnRequest = archiveController;
    try {
      assertEquals(
        await archive(rpc, first.sequence, first.sequence, none, {
          isRunning: () => !archiveController.signal.aborted,
        }),
        first.sequence,
      );
    } finally {
      abortOnRequest = undefined;
    }
  });
});
