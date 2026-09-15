import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { NetworkConfig } from "@colibri/core/network";
import { createColibriConfig, type WalletConnection } from "@/config.ts";
import { ColibriReactError } from "@/error.ts";
import { colibriQueryKey, queryValue } from "@/query.ts";
const network = NetworkConfig.TestNet();
const connection: WalletConnection = {
  address: "G-test",
  networkPassphrase: network.networkPassphrase,
  signers: [],
};
describe("connection and cache isolation", () => {
  it("starts disconnected and snapshots network configuration", () => {
    const original = NetworkConfig.CustomNet({ networkPassphrase: "custom" });
    const config = createColibriConfig({ network: original });
    original.rpcUrl = "https://later.test";
    assertEquals(config.network.rpcUrl, undefined);
    assertEquals(config.getServerSnapshot().status, "disconnected");
    assertEquals(config.getSnapshot(), config.getSnapshot());
    config.destroy();
  });
  it("does not restore permission by calling connect", async () => {
    let calls = 0;
    const config = createColibriConfig({
      network,
      connectors: [{
        id: "wallet",
        connect: () => {
          calls++;
          return Promise.resolve(connection);
        },
      }],
    });
    assertEquals(await config.connect("wallet", true), null);
    assertEquals(calls, 0);
    assertEquals(config.getSnapshot().status, "disconnected");
    config.destroy();
  });
  it("rejects superseded connect results and releases account listeners", async () => {
    let finish!: (value: WalletConnection) => void;
    let cleaned = 0;
    let disconnected = 0;
    let listener!: (value: WalletConnection | null) => void;
    const config = createColibriConfig({
      network,
      connectors: [{
        id: "slow",
        connect: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      }, {
        id: "fast",
        connect: () => Promise.resolve(connection),
        disconnect: () => {
          disconnected++;
          return Promise.resolve();
        },
        subscribe: (fn) => {
          listener = fn;
          return () => {
            cleaned++;
          };
        },
      }],
    });
    const slow = config.connect("slow");
    await config.connect("fast");
    finish(connection);
    await assertRejects(() => slow, ColibriReactError);
    listener({ ...connection, address: "G-other" });
    assertEquals(config.getSnapshot().connection?.address, "G-other");
    listener({ ...connection, networkPassphrase: "wrong" });
    assertEquals(config.getSnapshot().status, "disconnected");
    assert(config.getSnapshot().error instanceof ColibriReactError);
    await config.disconnect();
    assertEquals(cleaned, 1);
    assertEquals(disconnected, 1);
    config.destroy();
  });
  it("keeps local state disconnected even when wallet cleanup rejects", async () => {
    const error = new Error("wallet");
    const config = createColibriConfig({
      network,
      connectors: [{
        id: "wallet",
        connect: () => Promise.resolve(connection),
        disconnect: () => Promise.reject(error),
      }],
    });
    await config.connect("wallet");
    await assertRejects(() => config.disconnect());
    assertEquals(config.getSnapshot().connection, undefined);
    config.destroy();
  });
  it("reports invalid connectors, duplicate ids, and wrong networks", async () => {
    const connector = {
      id: "wallet",
      connect: () =>
        Promise.resolve({ ...connection, networkPassphrase: "wrong" }),
    };
    assertThrows(
      () =>
        createColibriConfig({ network, connectors: [connector, connector] }),
      ColibriReactError,
    );
    const config = createColibriConfig({ network, connectors: [connector] });
    await assertRejects(() => config.connect("absent"), ColibriReactError);
    await assertRejects(() => config.connect("wallet"), ColibriReactError);
    config.destroy();
  });
  it("keys bigint, bytes, maps, missing fields and sorted objects without collisions", () => {
    assertEquals(queryValue({ b: 2, a: 1 }), queryValue({ a: 1, b: 2 }));
    assertEquals(
      queryValue(new Map([[2n, "b"], [1n, "a"]])),
      queryValue(new Map([[1n, "a"], [2n, "b"]])),
    );
    const keys = [1, 1n, "1", undefined, null, new Uint8Array([1]), [1], {}, {
      a: undefined,
    }].map((x) => JSON.stringify(queryValue(x)));
    assertEquals(new Set(keys).size, keys.length);
    const cycle: unknown[] = [];
    cycle.push(cycle);
    for (const value of [cycle, NaN, () => 0, new Date()]) {
      assertThrows(() => queryValue(value), ColibriReactError);
    }
    assertEquals(queryValue({ toXDR: () => "xdr" }), ["xdr", "xdr"]);
    assertEquals(queryValue({ toXdr: () => "xdr" }), ["xdr", "xdr"]);
  });
  it("isolates networks and RPC namespaces", () => {
    const a = createColibriConfig({ network });
    const b = createColibriConfig({ network: NetworkConfig.MainNet() });
    const c = createColibriConfig({ network, scope: "other" });
    assertEquals(
      new Set(
        [a, b, c].map((x) =>
          JSON.stringify(colibriQueryKey(x, "balance", { address: "G" }))
        ),
      ).size,
      3,
    );
    for (const config of [a, b, c]) config.destroy();
  });
});
