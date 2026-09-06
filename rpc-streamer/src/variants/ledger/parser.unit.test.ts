import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { NetworkConfig } from "@colibri/core";
import { Networks } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { getLedgerFixture } from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";
import { createLedgerParser } from "@/variants/ledger/parser.ts";
import { RPCStreamerError, RPCStreamerErrorCode as Code } from "@/errors.ts";

describe("Ledger network context over native RPC transport", () => {
  const entry = getLedgerFixture(30000000)!;
  it("uses configured identity without RPC discovery", async () => {
    const config: NetworkConfig = NetworkConfig.MainNet();
    const parse = createLedgerParser(config);
    const ledger = await parse(
      new Server("http://127.0.0.1:0", { allowHttp: true }),
      entry,
    );
    assert(ledger.transactions[0].hasEnvelope);
  });
  it("caches successful discovery per RPC instance and retries failures", async () => {
    let requests = 0;
    let response: "failure" | "empty" | "success" | "missing" = "failure";
    const server = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen() {} },
      async (request) => {
        requests++;
        const { id, method } = await request.json();
        assertEquals(method, "getNetwork");
        return Response.json(
          response === "failure"
            ? {
              jsonrpc: "2.0",
              id,
              error: {
                code: -32603,
                message: "Network temporarily unavailable",
              },
            }
            : {
              jsonrpc: "2.0",
              id,
              result: {
                passphrase: response === "missing"
                  ? undefined
                  : response === "empty"
                  ? ""
                  : Networks.PUBLIC,
                protocolVersion: 28,
              },
            },
        );
      },
    );
    try {
      const rpc = new Server(`http://127.0.0.1:${server.addr.port}`, {
        allowHttp: true,
      });
      const parse = createLedgerParser();
      const failure = await assertRejects(
        () => parse(rpc, entry),
        RPCStreamerError,
      );
      assertEquals(failure.code, Code.NETWORK_DISCOVERY_FAILED);
      assert(failure.cause instanceof Error);
      response = "empty";
      const empty = await assertRejects(
        () => parse(rpc, entry),
        RPCStreamerError,
      );
      assertEquals(empty.code, Code.INVALID_NETWORK_PASSPHRASE);
      response = "missing";
      assertEquals(
        (await assertRejects(() => parse(rpc, entry), RPCStreamerError)).code,
        Code.INVALID_NETWORK_PASSPHRASE,
      );
      response = "success";
      assert((await parse(rpc, entry)).transactions[0].hasEnvelope);
      assert((await parse(rpc, entry)).transactions[0].hasEnvelope);
      assertEquals(requests, 4);
      const other = new Server(rpc.serverURL.toString(), { allowHttp: true });
      assert((await parse(other, entry)).transactions[0].hasEnvelope);
      assertEquals(requests, 5);
      const unreachable = new Server("http://127.0.0.1:0", { allowHttp: true });
      const transport = await assertRejects(
        () => parse(unreachable, entry),
        RPCStreamerError,
      );
      assertEquals(transport.code, Code.NETWORK_DISCOVERY_FAILED);
      assert(transport.cause instanceof Error);
    } finally {
      await server.shutdown();
    }
  });
});
