import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Asset, Operation, xdr } from "stellar-sdk";
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
  },
);
