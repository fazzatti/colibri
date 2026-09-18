import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import { spy } from "@std/testing/mock";
import { rpc } from "stellar-sdk";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { withArchiveReadRetries } from "colibri-internal/tests/archive-rpc.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const ledgerRequest = { startLedger: 1 };
const ledgerResponse = { ledgers: [] } as unknown as rpc.Api.GetLedgersResponse;
const eventResponse = { events: [] } as unknown as rpc.Api.GetEventsResponse;

describe("repository archive read retry policy", () => {
  it("repeats the same reads before delivery and preserves native receivers and results", async () => {
    const server = new rpc.Server("https://archive.example.test");
    const delays: number[] = [];
    const ledgerStatuses = [502, 503], eventStatuses = [429, 504];
    const ledgers = spy(
      function (this: rpc.Server, request: rpc.Api.GetLedgersRequest) {
        assertStrictEquals(this, server);
        assertStrictEquals(request, ledgerRequest);
        const status = ledgerStatuses.shift();
        return status
          ? Promise.reject({ response: { status } })
          : Promise.resolve(ledgerResponse);
      },
    );
    server.getLedgers = ledgers;
    const eventRequest = { startLedger: 1, filters: [] };
    const events = spy(
      function (this: rpc.Server, request: rpc.Api.GetEventsRequest) {
        assertStrictEquals(this, server);
        assertStrictEquals(request, eventRequest);
        const status = eventStatuses.shift();
        return status
          ? Promise.reject({ response: { status } })
          : Promise.resolve(eventResponse);
      },
    );
    server.getEvents = events;
    assertStrictEquals(
      withArchiveReadRetries(server, (ms) => {
        delays.push(ms);
        return Promise.resolve();
      }),
      server,
    );
    assertStrictEquals(await server.getLedgers(ledgerRequest), ledgerResponse);
    assertStrictEquals(await server.getEvents(eventRequest), eventResponse);
    assertEquals(ledgers.calls.length, 3);
    assertEquals(events.calls.length, 3);
    assertEquals(delays, [1_000, 2_000, 1_000, 2_000]);
  });

  it("fails non-transient errors immediately without replacing their identity", async () => {
    for (
      const error of [
        undefined,
        null,
        "network failure",
        new Error("assertion failed"),
        { response: undefined },
        { response: { status: 400 } },
        { response: { status: 401 } },
        { response: { status: 500 } },
        { response: { status: "503" } },
      ]
    ) {
      const server = new rpc.Server("https://archive.example.test");
      const reads = spy(() => Promise.reject(error));
      server.getLedgers = reads;
      let sleeps = 0, rejected = false;
      withArchiveReadRetries(server, () => {
        sleeps++;
        return Promise.resolve();
      });
      try {
        await server.getLedgers(ledgerRequest);
      } catch (caught) {
        rejected = true;
        assertStrictEquals(caught, error);
      }
      assert(rejected);
      assertEquals(reads.calls.length, 1);
      assertEquals(sleeps, 0);
    }
  });

  it("exhausts two retries per request and rethrows the last provider failure", async () => {
    const server = new rpc.Server("https://archive.example.test");
    const error = { response: { status: 503 } }, delays: number[] = [];
    const reads = spy(() => Promise.reject(error));
    server.getLedgers = reads;
    withArchiveReadRetries(server, (ms) => {
      delays.push(ms);
      return Promise.resolve();
    });
    for (let request = 0; request < 2; request++) {
      let rejected = false;
      try {
        await server.getLedgers(ledgerRequest);
      } catch (caught) {
        rejected = true;
        assertStrictEquals(caught, error);
      }
      assert(rejected);
    }
    assertEquals(reads.calls.length, 6);
    assertEquals(delays, [1_000, 2_000, 1_000, 2_000]);
  });

  it("recovers an actual native SDK HTTP 503 with the default delay", async () => {
    const requests: unknown[] = [];
    const http = Deno.serve({ port: 0, onListen() {} }, async (request) => {
      const body = await request.json();
      requests.push(body);
      return requests.length === 1
        ? new Response("Service unavailable", { status: 503 })
        : Response.json({
          jsonrpc: "2.0",
          id: body.id,
          result: ledgerResponse,
        });
    });
    try {
      const server = withArchiveReadRetries(
        new rpc.Server(`http://127.0.0.1:${http.addr.port}`, {
          allowHttp: true,
        }),
      );
      const result = await server.getLedgers(ledgerRequest);
      assertEquals(result.ledgers, []);
      assertEquals(requests.length, 2);
      assertEquals(
        requests.map((request) => (request as { params: unknown }).params),
        [ledgerRequest, ledgerRequest],
      );
    } finally {
      await http.shutdown();
    }
  });
});
