import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { NetworkConfig } from "@colibri/core";
import { Server } from "stellar-sdk/rpc";
import {
  createEventStreamer,
  createLedgerStreamer,
  RPCStreamer,
} from "@colibri/rpc-streamer";
import type { EventStreamerConfig } from "@colibri/rpc-streamer";
import { RPCStreamerError, RPCStreamerErrorCode as Code } from "@/errors.ts";

describe("native streamer connections", () => {
  const url = "http://127.0.0.1:8000/rpc";
  const networkConfig = NetworkConfig.CustomNet({
    networkPassphrase: "test",
    rpcUrl: url,
    allowHttp: true,
  });
  it("accepts URL, NetworkConfig, and caller-owned Server in all constructors", () => {
    const rpc = new Server(url, { allowHttp: true });
    const archiveRpc = new Server(url, { allowHttp: true });
    for (
      const create of [
        createEventStreamer,
        createLedgerStreamer,
        (config: EventStreamerConfig) => new RPCStreamer(config),
      ]
    ) {
      assertEquals(create({ rpc, archiveRpc }).rpc, rpc);
      assertEquals(create({ rpc, archiveRpc }).archiveRpc, archiveRpc);
      assertEquals(
        create({ networkConfig }).rpc.serverURL.toString(),
        rpc.serverURL.toString(),
      );
      assertEquals(
        create({ rpcUrl: url, allowHttp: true, archiveRpcUrl: url }).archiveRpc
          ?.serverURL.toString(),
        rpc.serverURL.toString(),
      );
      assertEquals(
        create({ networkConfig, archiveRpcUrl: url }).archiveRpc?.serverURL
          .toString(),
        rpc.serverURL.toString(),
      );
      assertEquals(
        create({ rpc, archiveRpcUrl: url, archiveAllowHttp: true }).archiveRpc
          ?.serverURL.toString(),
        rpc.serverURL.toString(),
      );
    }
  });
  it("rejects ambiguous runtime inputs and invalid URLs with occurrence-specific errors", () => {
    const rpc = new Server("https://rpc.example.com");
    const cases: [unknown, Code][] = [
      [{}, Code.INVALID_LIVE_CONNECTION],
      [{ rpc, rpcUrl: url }, Code.INVALID_LIVE_CONNECTION],
      [{ rpc, allowHttp: true }, Code.INVALID_LIVE_CONNECTION],
      [{ networkConfig, rpc }, Code.INVALID_LIVE_CONNECTION],
      [{ rpcUrl: url }, Code.LIVE_CONNECTION_FAILED],
      [
        { rpc, archiveRpc: rpc, archiveRpcUrl: url },
        Code.INVALID_ARCHIVE_CONNECTION,
      ],
      [
        { rpc, archiveRpc: rpc, archiveAllowHttp: true },
        Code.INVALID_ARCHIVE_CONNECTION,
      ],
      [{ rpc, archiveRpcUrl: url }, Code.ARCHIVE_CONNECTION_FAILED],
      [{
        networkConfig: NetworkConfig.CustomNet({ networkPassphrase: "test" }),
      }, Code.MISSING_LIVE_RPC_URL],
    ];
    for (const [config, code] of cases) {
      assertEquals(
        assertThrows(
          () => createEventStreamer(config as EventStreamerConfig),
          RPCStreamerError,
        )
          .code,
        code,
      );
    }
  });
});
