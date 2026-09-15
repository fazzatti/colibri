import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { NetworkConfig } from "@colibri/core/network";
import {
  createColibriConfig,
  type WalletConnection,
} from "@/context/config.ts";
import { ColibriReactError } from "@/errors/index.ts";
const network = NetworkConfig.TestNet();
const connection: WalletConnection = {
  address: "G-test",
  networkPassphrase: network.networkPassphrase,
  signers: [],
};
describe("connection and cache isolation", () => {
  it("unsubscribes the prior wallet when switching directly to another connector", async () => {
    let cleanup = 0;
    let stale!: (value: WalletConnection | null) => void;
    const config = createColibriConfig({
      network,
      connectors: [
        {
          id: "first",
          connect: () => Promise.resolve(connection),
          subscribe: (listener) => {
            stale = listener;
            return () => {
              cleanup++;
            };
          },
        },
        {
          id: "second",
          connect: () =>
            Promise.resolve({ ...connection, address: "G-second" }),
        },
      ],
    });
    await config.connect("first");
    await config.connect("second");
    assertEquals(cleanup, 1);
    stale(connection);
    assertEquals(config.getSnapshot().connection?.address, "G-second");
    config.destroy();
  });
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
    listener(connection);
    assertEquals(config.getSnapshot().status, "disconnected");
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
    assertThrows(
      () =>
        createColibriConfig({
          network: NetworkConfig.CustomNet({ networkPassphrase: "" }),
        }),
      ColibriReactError,
    );
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
});
