import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Asset, Operation, xdr } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import {
  createClassicTransactionPipeline,
  type Event,
  EventFilter,
  EventType,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
  SACEvents,
} from "@colibri/core";
import { StellarTestLedger } from "@colibri/test-tooling";
import { createEventStreamer } from "@/variants/event/index.ts";
import { createLedgerStreamer } from "@/variants/ledger/index.ts";
import { RPCStreamerError, RPCStreamerErrorCode } from "@/errors.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";

describe(
  "[Quickstart] live event paging regressions",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName: "colibri-event-paging-regressions",
      containerImageVersion: "testing",
      logLevel: "silent",
    });
    const sender = LocalSigner.generateRandom();
    const recipient = LocalSigner.generateRandom();
    let network: ReturnType<typeof NetworkConfig.CustomNet>;
    let rpcUrl: string;
    let startLedger: number;
    let stopLedger: number;

    const newStreamer = (
      filters = [
        new EventFilter({
          type: EventType.Contract,
          topics: [SACEvents.TransferEvent.toTopicFilter()],
        }),
      ],
      limit = 7,
    ) =>
      createEventStreamer({
        rpcUrl,
        allowHttp: true,
        filters,
        options: { limit, pagingIntervalMs: 0, waitLedgerIntervalMs: 50 },
      });

    beforeAll(async () => {
      await ledger.start();
      const details = await ledger.getNetworkDetails();
      rpcUrl = details.rpcUrl;
      network = NetworkConfig.CustomNet(details);
      for (const signer of [sender, recipient]) {
        await initializeWithFriendbot(
          details.friendbotUrl,
          signer.publicKey(),
          {
            rpcUrl: details.rpcUrl,
            allowHttp: true,
          },
        );
      }
      const execute = createClassicTransactionPipeline({
        networkConfig: network,
      });
      for (let batch = 0; batch < 2; batch++) {
        const result = await execute({
          operations: Array.from({ length: 40 }, () =>
            Operation.payment({
              destination: recipient.publicKey(),
              asset: Asset.native(),
              amount: "0.01",
            })),
          config: {
            source: sender.publicKey(),
            fee: "100",
            timeout: 60,
            signers: [sender],
          },
        });
        if (batch === 0) startLedger = result.response.ledger;
        stopLedger = result.response.ledger;
      }
      assert(stopLedger > startLedger);
    });
    afterAll(async () => {
      await ledger.destroy();
    });

    for (const mode of ["startLive", "start"] as const) {
      it(`${mode} emits all 80 events once across pages and ledgers, including on a fresh run`, async () => {
        const streamer = newStreamer();
        for (let run = 0; run < 2; run++) {
          const events: Event[] = [];
          const checkpoints: number[] = [];
          await streamer[mode]((event) => {
            events.push(event);
          }, {
            startLedger,
            stopLedger,
            checkpointInterval: 1,
            onCheckpoint: (sequence) => {
              checkpoints.push(sequence);
            },
          });
          assertEquals(events.length, 80);
          assertEquals(new Set(events.map((event) => event.id)).size, 80);
          assert(
            events.every((event) =>
              event.ledger >= startLedger && event.ledger <= stopLedger
            ),
          );
          assertEquals(
            checkpoints,
            Array.from(
              { length: stopLedger - startLedger + 1 },
              (_, i) => startLedger + i,
            ),
          );
        }
      });

      for (const limit of [1, 7]) {
        it(`${mode} stops callbacks immediately with a page size of ${limit}`, async () => {
          const streamer = newStreamer(undefined, limit);
          let callbacks = 0;
          const checkpoints: number[] = [];
          await streamer[mode](() => {
            callbacks++;
            streamer.stop();
          }, {
            startLedger,
            stopLedger,
            checkpointInterval: 1,
            onCheckpoint: (ledger) => {
              checkpoints.push(ledger);
            },
          });
          assertEquals(callbacks, 1);
          assertEquals(checkpoints, []);
        });
      }

      it(`${mode} waits for a new ledger at the tip instead of requesting an unavailable ledger`, async () => {
        const streamer = newStreamer([
          new EventFilter({
            topics: [[xdr.ScVal.scvSymbol("never-emitted-audit-topic")]],
          }),
        ]);
        const latest = (await streamer.rpc.getHealth()).latestLedger;
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          streamer.stop();
        }, 30_000);
        try {
          await streamer[mode](() => {
            throw new Error("Unexpected event for empty filter");
          }, {
            startLedger: latest,
            stopLedger: latest + 1,
          });
          assertEquals(timedOut, false);
          assert((await streamer.rpc.getHealth()).latestLedger >= latest + 1);
        } finally {
          clearTimeout(timer);
          streamer.stop();
        }
      });
    }

    it("still rejects an explicitly unavailable starting ledger", async () => {
      const streamer = newStreamer();
      const latest = (await streamer.rpc.getHealth()).latestLedger;
      const error = await assertRejects(
        () => streamer.start(() => {}, { startLedger: latest + 100 }),
        RPCStreamerError,
      );
      assertEquals(error.code, RPCStreamerErrorCode.LEDGER_TOO_HIGH);
    });

    for (const mode of ["startLive", "start"] as const) {
      it(`${mode} checkpoints the final ledger even when cursor results include later matching events`, async () => {
        const streamer = newStreamer();
        const checkpoints: number[] = [];
        let count = 0;
        await streamer[mode](() => {
          count++;
        }, {
          startLedger,
          stopLedger: startLedger,
          checkpointInterval: 1,
          onCheckpoint: (ledger) => {
            checkpoints.push(ledger);
          },
        });
        assertEquals(count, 40);
        assertEquals(checkpoints, [startLedger]);
        assertEquals(streamer.nextLedger, startLedger + 1);
      });

      it(`${mode} interrupts a pending page timer and detaches the previous run's signal`, async () => {
        const controller = new AbortController();
        const streamer = createEventStreamer({
          rpcUrl,
          allowHttp: true,
          filters: [
            new EventFilter({
              type: EventType.Contract,
              topics: [SACEvents.TransferEvent.toTopicFilter()],
            }),
          ],
          options: {
            limit: 1,
            pagingIntervalMs: 60_000,
            waitLedgerIntervalMs: 60_000,
          },
        });
        let timer: number | undefined;
        let count = 0;
        const started = Date.now();
        try {
          await streamer[mode](() => {
            count++;
            timer = setTimeout(() => controller.abort(), 20);
          }, { startLedger, stopLedger, signal: controller.signal });
          assertEquals(count, 1);
          assertEquals(streamer.nextLedger, startLedger);
          assert(Date.now() - started < 10_000);
        } finally {
          clearTimeout(timer);
        }

        const reusable = newStreamer();
        const previous = new AbortController();
        await reusable[mode](() => {}, {
          startLedger,
          stopLedger,
          signal: previous.signal,
        });
        let delivered = 0;
        await reusable[mode](() => {
          previous.abort();
          delivered++;
        }, { startLedger, stopLedger });
        assertEquals(delivered, 80);
      });
    }

    for (const mode of ["startLive", "start", "startArchive"] as const) {
      it(`ledger ${mode} awaits persistence and does not checkpoint an interrupted callback`, async () => {
        const streamer = createLedgerStreamer({
          networkConfig: network,
          archiveRpcUrl: rpcUrl,
          options: {
            pagingIntervalMs: 0,
            archivalIntervalMs: 0,
            waitLedgerIntervalMs: 50,
          },
        });
        let persisted = startLedger - 1;
        await streamer[mode]((ledger) => {
          assertEquals(ledger.sequence, persisted + 1);
        }, {
          startLedger,
          stopLedger,
          checkpointInterval: 1,
          onCheckpoint: async (sequence) => {
            await new Promise((resolve) => setTimeout(resolve, 1));
            persisted = sequence;
          },
        });
        assertEquals(streamer.nextLedger, stopLedger + 1);
        const controller = new AbortController();
        let callbacks = 0;
        await streamer[mode](() => {
          callbacks++;
          controller.abort();
        }, {
          startLedger,
          stopLedger,
          signal: controller.signal,
          checkpointInterval: 1,
          onCheckpoint: () => {
            throw new Error("Partial ledger must not be checkpointed");
          },
        });
        assertEquals(callbacks, 1);
        assertEquals(streamer.nextLedger, startLedger);
        const failure = await assertRejects(() =>
          streamer[mode](() => {}, {
            startLedger,
            stopLedger,
            checkpointInterval: 1,
            onCheckpoint: () =>
              Promise.reject(new Error("database unavailable")),
            onError: () => true,
          }), RPCStreamerError);
        assertEquals(failure.code, RPCStreamerErrorCode.CHECKPOINT_FAILED);
        assertEquals(streamer.nextLedger, startLedger);
      });
    }

    it("interrupts an archive pacing wait after completing the ledger", async () => {
      const controller = new AbortController();
      const streamer = createLedgerStreamer({
        networkConfig: network,
        archiveRpcUrl: rpcUrl,
        options: { archivalIntervalMs: 60_000 },
      });
      let timer: number | undefined;
      try {
        await streamer.startArchive(() => {}, {
          startLedger,
          stopLedger,
          signal: controller.signal,
          checkpointInterval: 1,
          onCheckpoint: () => {
            timer = setTimeout(() => controller.abort(), 20);
          },
        });
        assertEquals(streamer.nextLedger, startLedger + 1);
      } finally {
        clearTimeout(timer);
      }
    });

    it("keeps the archived path consistent with the same 80 confirmed events", async () => {
      const streamer = newStreamer();
      streamer.setArchiveRpc(rpcUrl, true);
      const events: Event[] = [];
      const checkpoints: number[] = [];
      await streamer.startArchive((event) => {
        events.push(event);
      }, {
        startLedger,
        stopLedger,
        checkpointInterval: 1,
        onCheckpoint: (sequence) => {
          checkpoints.push(sequence);
        },
      });
      assertEquals(events.length, 80);
      assertEquals(
        events.every((event) => event.inSuccessfulContractCall),
        true,
      );
      assertEquals(
        checkpoints,
        Array.from(
          { length: stopLedger - startLedger + 1 },
          (_, i) => startLedger + i,
        ),
      );
    });

    for (const mode of ["startLive", "start", "startArchive"] as const) {
      it(`${mode} awaits persistence and exposes the next fully consumed ledger`, async () => {
        const streamer = newStreamer();
        streamer.setArchiveRpc(rpcUrl, true);
        let persisted = startLedger - 1;
        await streamer[mode]((event) => {
          assert(event.ledger <= persisted + 1);
        }, {
          startLedger,
          stopLedger,
          checkpointInterval: 1,
          onCheckpoint: async (sequence) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            persisted = sequence;
          },
        });
        assertEquals(persisted, stopLedger);
        assertEquals(streamer.nextLedger, stopLedger + 1);
      });

      it(`${mode} does not skip a ledger when checkpoint persistence fails`, async () => {
        const streamer = newStreamer();
        streamer.setArchiveRpc(rpcUrl, true);
        let recoveryCalled = false;
        const failure = new Error("Application persistence failed");
        const error = await assertRejects(() =>
          streamer[mode](() => {}, {
            startLedger,
            stopLedger,
            checkpointInterval: 1,
            onCheckpoint: () => Promise.reject(failure),
            onError: () => {
              recoveryCalled = true;
              return true;
            },
          }), RPCStreamerError);
        assertEquals(error.code, RPCStreamerErrorCode.CHECKPOINT_FAILED);
        assertEquals(error.cause, failure);
        assertEquals(recoveryCalled, false);
        assertEquals(streamer.nextLedger, startLedger);
      });

      it(`${mode} aborts between events and leaves a partial ledger for replay`, async () => {
        const controller = new AbortController();
        const streamer = newStreamer();
        streamer.setArchiveRpc(rpcUrl, true);
        let callbacks = 0;
        await streamer[mode](() => {
          callbacks++;
          controller.abort();
        }, {
          startLedger,
          stopLedger,
          signal: controller.signal,
        });
        assertEquals(callbacks, 1);
        assertEquals(streamer.nextLedger, startLedger);
      });
    }

    for (const mode of ["startLive", "start"] as const) {
      it(`${mode} observes cancellation while the real health request is in flight`, async () => {
        const controller = new AbortController();
        let healthRequests = 0;
        // Coordinate cancellation at a real SDK response boundary. No response
        // or transport is replaced: every request goes to the Quickstart node.
        class ObservedServer extends Server {
          override async getHealth() {
            const response = await super.getHealth();
            if (++healthRequests === 2) controller.abort();
            return response;
          }
        }
        const streamer = createLedgerStreamer({
          rpc: new ObservedServer(rpcUrl, { allowHttp: true }),
        });
        let delivered = 0;
        await streamer[mode](() => {
          delivered++;
        }, { startLedger, stopLedger, signal: controller.signal });
        assertEquals(healthRequests, 2);
        assertEquals(delivered, 0);
        assertEquals(streamer.nextLedger, startLedger);
      });
    }

    it("does not deliver a ledger cancelled while the real ledger request is in flight", async () => {
      const controller = new AbortController();
      class ObservedServer extends Server {
        override async getLedgers(
          options: Parameters<Server["getLedgers"]>[0],
        ) {
          const response = await super.getLedgers(options);
          controller.abort();
          return response;
        }
      }
      const streamer = createLedgerStreamer({
        rpc: new ObservedServer(rpcUrl, { allowHttp: true }),
      });
      let delivered = 0;
      await streamer.startLive(() => {
        delivered++;
      }, { startLedger, stopLedger, signal: controller.signal });
      assertEquals(delivered, 0);
      assertEquals(streamer.nextLedger, startLedger);
    });

    for (const createStreamer of [createEventStreamer, createLedgerStreamer]) {
      it(`${createStreamer.name} does not consume a cancelled archive response`, async () => {
        const controller = new AbortController();
        const streamer = createStreamer({
          networkConfig: network,
          archiveRpcUrl: rpcUrl,
        });
        let delivered = 0;
        const run = streamer.startArchive(() => {
          delivered++;
        }, { startLedger, stopLedger, signal: controller.signal });
        controller.abort();
        await run;
        assertEquals(delivered, 0);
        assertEquals(streamer.nextLedger, startLedger);
      });
    }

    it("keeps a stopped run exclusive until its active callback settles", async () => {
      const streamer = createLedgerStreamer({ networkConfig: network });
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const run = streamer.startLive(async () => {
        entered();
        await held;
      }, { startLedger, stopLedger });
      await started;
      streamer.stop();
      const error = await assertRejects(
        () => streamer.startLive(() => {}, { startLedger, stopLedger }),
        RPCStreamerError,
      );
      assertEquals(error.code, RPCStreamerErrorCode.ALREADY_RUNNING);
      release();
      await run;
      assertEquals(streamer.nextLedger, startLedger);
    });
  },
);
