import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  type KitEvent,
  KitEventType,
  type ModuleInterface,
  ModuleType,
} from "@creit.tech/stellar-wallets-kit/types";
import { Account, TransactionBuilder } from "stellar-sdk/base";
import { type EnvelopeSigner, LocalSigner, NetworkConfig } from "@colibri/core";
import { createColibriConfig } from "@/context/config.ts";
import { ColibriReactError } from "@/errors/index.ts";
import { createStellarWalletsKitConnector } from "@/ecosystem/stellar-wallets-kit/connector.ts";
import type { StellarWalletsKitApi } from "@/ecosystem/stellar-wallets-kit/types.ts";

const network = NetworkConfig.TestNet();
const key = LocalSigner.generateRandom();
const address = key.publicKey();
const tx = new TransactionBuilder(new Account(address, "1"), {
  fee: "100",
  networkPassphrase: network.networkPassphrase,
}).setTimeout(0).build();
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fixture() {
  const state = {
    address,
    networkPassphrase: network.networkPassphrase as string,
    prompts: 0,
    signatures: 0,
    disconnects: 0,
    addressError: undefined as unknown,
    networkError: undefined as unknown,
    moduleError: undefined as unknown,
  };
  const module: ModuleInterface = {
    productId: "test-wallet",
    productName: "Test wallet",
    productUrl: "https://wallet.test",
    productIcon: "",
    moduleType: ModuleType.HOT_WALLET,
    isAvailable: () => Promise.resolve(true),
    getAddress: () => Promise.resolve({ address: state.address }),
    getNetwork: () =>
      Promise.resolve({
        network: "TESTNET",
        networkPassphrase: state.networkPassphrase,
      }),
    signTransaction: () => Promise.resolve({ signedTxXdr: tx.toXDR() }),
    signAuthEntry: () => Promise.reject(new Error("unsupported")),
    signMessage: () => Promise.reject(new Error("unsupported")),
  };
  let selected = module;
  const listeners = new Map<KitEventType, (event: KitEvent) => void>();
  const emit = (type: KitEventType) => {
    const event: KitEvent = type === KitEventType.STATE_UPDATED
      ? {
        eventType: type,
        payload: {
          address: state.address,
          networkPassphrase: state.networkPassphrase,
        },
      }
      : type === KitEventType.WALLET_SELECTED
      ? { eventType: type, payload: { id: selected.productId } }
      : { eventType: KitEventType.DISCONNECT, payload: {} };
    listeners.get(type)?.(event);
  };
  const kit: StellarWalletsKitApi = {
    get selectedModule() {
      if (state.moduleError) throw state.moduleError;
      return selected;
    },
    authModal: () => {
      state.prompts++;
      return Promise.resolve({ address: state.address });
    },
    getAddress: () =>
      state.addressError
        ? Promise.reject(state.addressError)
        : Promise.resolve({ address: state.address }),
    getNetwork: () =>
      state.networkError
        ? Promise.reject(state.networkError)
        : module.getNetwork(),
    signTransaction: (_xdr, options) => {
      state.signatures++;
      assertEquals(options, {
        address: state.address,
        networkPassphrase: state.networkPassphrase,
      });
      return module.signTransaction(tx.toXDR(), options);
    },
    disconnect: () => {
      state.disconnects++;
      return Promise.resolve();
    },
    on: ((type: KitEventType, listener: (event: KitEvent) => void) => {
      listeners.set(type, listener);
      if (type !== KitEventType.DISCONNECT) emit(type);
      return () => {
        listeners.delete(type);
      };
    }) as StellarWalletsKitApi["on"],
  };
  const connector = createStellarWalletsKitConnector(kit, {
    capabilities: () => ({ envelope: true }),
  });
  const signer = async () =>
    (await connector.connect()).signers[0] as EnvelopeSigner;
  return {
    kit,
    state,
    connector,
    signer,
    emit,
    listeners,
    module,
    select: (next: ModuleInterface) => {
      selected = next;
    },
  };
}

describe("Wallets Kit ecosystem adapter", () => {
  it("connects explicitly, restores only cached state and signs without submitting", async () => {
    const f = fixture();
    assertEquals(f.state.prompts, 0);
    const restored = await f.connector.reconnect!();
    assertEquals(restored?.address, address);
    assertEquals(f.state.prompts, 0);
    const signer = await f.signer();
    assertEquals(await signer.signTransaction(tx), tx.toXDR());
    assertEquals(f.state.prompts, 1);
    assertEquals(f.state.signatures, 1);
    await f.connector.disconnect!();
    assertEquals(f.state.disconnects, 1);
    assertEquals(await f.connector.reconnect!(), null);
    await assertRejects(
      () => Promise.resolve(signer.signTransaction(tx)),
      ColibriReactError,
    );
  });

  it("preserves explicit capabilities and application connection UI", async () => {
    const f = fixture();
    const contractAddress = "C".repeat(56);
    f.state.address = contractAddress as typeof address;
    const custom = createStellarWalletsKitConnector(f.kit, {
      id: "custom",
      connect: () => Promise.resolve({ address: contractAddress }),
      capabilities: (account) => {
        assertEquals(account.module, f.module);
        return { signers: [key], messageSigner: key };
      },
    });
    const connection = await custom.connect();
    assertEquals(custom.id, "custom");
    assertEquals(connection.signers, [key]);
    assertEquals(connection.messageSigner, key);
    assertEquals(f.state.prompts, 0);
    await assertRejects(() => f.connector.connect(), ColibriReactError);
    const readonly = createStellarWalletsKitConnector(f.kit, {
      capabilities: () => ({}),
    });
    assertEquals((await readonly.connect()).signers, []);
  });

  it("preserves initial snapshots and requires explicit restoration after account/network invalidation", async () => {
    const f = fixture();
    const config = createColibriConfig({ network, connectors: [f.connector] });
    const original = await config.connect(f.connector.id);
    await tick();
    assertEquals(config.getSnapshot().connection?.address, original?.address);
    assertEquals(f.listeners.size, 3);
    f.state.address = LocalSigner.generateRandom().publicKey();
    f.emit(KitEventType.STATE_UPDATED);
    assertEquals(config.getSnapshot().status, "disconnected");
    await tick();
    assertEquals(config.getSnapshot().status, "disconnected");
    assertEquals(f.listeners.size, 0);
    await config.connect(f.connector.id, true);
    assertEquals(config.getSnapshot().connection?.address, f.state.address);
    f.state.networkPassphrase = "different";
    f.emit(KitEventType.STATE_UPDATED);
    await tick();
    assertEquals(config.getSnapshot().status, "disconnected");
    await assertRejects(
      () => config.connect(f.connector.id, true),
      ColibriReactError,
    );
    assert(config.getSnapshot().error instanceof ColibriReactError);
    config.destroy();
    assertEquals(f.listeners.size, 0);
  });

  it("closes the account-change gap before listener registration", async () => {
    const f = fixture();
    await f.connector.connect();
    f.state.address = LocalSigner.generateRandom().publicKey();
    const addresses: Array<string | null> = [];
    const stop = f.connector.subscribe!((value) =>
      addresses.push(value?.address ?? null)
    );
    try {
      await tick();
      assertEquals(addresses, [f.state.address]);
    } finally {
      stop();
    }
  });

  it("invalidates module switches even when Kit keeps the previous address", async () => {
    const f = fixture();
    const signer = await f.signer();
    const changes: unknown[] = [];
    const stop = f.connector.subscribe!((value) => changes.push(value));
    await tick();
    f.select({ ...f.module, productId: "other" });
    f.emit(KitEventType.WALLET_SELECTED);
    f.emit(KitEventType.STATE_UPDATED);
    await tick();
    assertEquals(changes.at(-1), null);
    assertEquals(await f.connector.reconnect!(), null);
    await assertRejects(
      () => Promise.resolve(signer.signTransaction(tx)),
      ColibriReactError,
    );
    stop();
    assertEquals((await f.connector.connect()).address, address);
  });

  it("rejects changes before, during and after signing, including returned signer identity", async () => {
    for (
      const phase of [
        "before",
        "during",
        "returned",
        "network",
        "module",
      ] as const
    ) {
      const f = fixture();
      const signer = await f.signer();
      if (phase === "before") {
        f.state.address = LocalSigner.generateRandom().publicKey();
      } else if (phase === "network") f.state.networkPassphrase = "wrong";
      else if (phase === "module") f.select({ ...f.module });
      else {
        f.kit.signTransaction = () => {
          const other = LocalSigner.generateRandom().publicKey();
          if (phase === "during") f.state.address = other;
          return Promise.resolve({
            signedTxXdr: tx.toXDR(),
            signerAddress: phase === "returned" ? other : address,
          });
        };
      }
      await assertRejects(
        () => Promise.resolve(signer.signTransaction(tx)),
        ColibriReactError,
      );
    }
  });

  it("distinguishes an absent cached connection from upstream failures", async () => {
    const f = fixture();
    f.state.moduleError = { code: -3 };
    assertEquals(await f.connector.reconnect!(), null);
    f.state.moduleError = new Error("module failure");
    assertEquals(
      await assertRejects(() => f.connector.reconnect!()),
      f.state.moduleError,
    );
    f.state.moduleError = undefined;
    f.state.addressError = { code: -1 };
    assertEquals(await f.connector.reconnect!(), null);
    f.state.addressError = new Error("address failure");
    assertEquals(
      await assertRejects(() => f.connector.reconnect!()),
      f.state.addressError,
    );
    f.state.addressError = undefined;
    f.state.address = "" as typeof address;
    assertEquals(await f.connector.reconnect!(), null);
    await assertRejects(() => f.connector.connect(), ColibriReactError);
    f.state.address = address;
    f.state.networkError = new Error("network failure");
    assertEquals(
      await assertRejects(() => f.connector.connect()),
      f.state.networkError,
    );
    f.state.networkError = undefined;
    f.state.networkPassphrase = "";
    await assertRejects(() => f.connector.connect(), ColibriReactError);
  });

  it("discards stale connection and refresh work after disconnect or unsubscribe", async () => {
    const f = fixture();
    let finish!: (value: { address: string }) => void;
    f.kit.authModal = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const connecting = f.connector.connect();
    await f.connector.disconnect!();
    finish({ address });
    await assertRejects(() => connecting, ColibriReactError);
    f.kit.authModal = () => Promise.resolve({ address });
    await f.connector.connect();
    // Restoring cached state must not resurrect authority after disconnect.
    const restoring = f.connector.reconnect!();
    await f.connector.disconnect!();
    await assertRejects(() => restoring, ColibriReactError);
    await f.connector.connect();
    const changes: unknown[] = [];
    const stop = f.connector.subscribe!((value) => changes.push(value));
    f.emit(KitEventType.STATE_UPDATED);
    stop();
    await tick();
    assertEquals(changes, [null]);
    assertEquals(f.listeners.size, 0);
  });

  it("fails closed on event-read errors and Kit disconnect", async () => {
    const f = fixture();
    await f.connector.connect();
    const changes: unknown[] = [];
    const stop = f.connector.subscribe!((value) => changes.push(value));
    await tick();
    f.state.networkError = new Error("lost wallet");
    f.emit(KitEventType.STATE_UPDATED);
    await tick();
    assertEquals(changes.at(-1), null);
    f.emit(KitEventType.DISCONNECT);
    assertEquals(await f.connector.reconnect!(), null);
    stop();
  });

  it("cleans partial subscriptions when Kit rejects registration", () => {
    const f = fixture();
    const on = f.kit.on;
    f.kit.on = ((type: KitEventType, callback: (event: KitEvent) => void) => {
      if (type === KitEventType.WALLET_SELECTED) {
        throw new Error("registration");
      }
      return (on as (
        type: KitEventType,
        callback: (event: KitEvent) => void,
      ) => () => void)(type, callback);
    }) as StellarWalletsKitApi["on"];
    assertThrows(() => f.connector.subscribe!(() => {}));
    assertEquals(f.listeners.size, 0);
  });

  it("rejects account/module changes while reading connection state", async () => {
    const f = fixture();
    f.kit.getNetwork = () => {
      f.select({ ...f.module });
      return f.module.getNetwork();
    };
    await assertRejects(() => f.connector.connect(), ColibriReactError);
  });
});
