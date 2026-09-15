import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Account, TransactionBuilder } from "stellar-sdk/base";
import { type EnvelopeSigner, LocalSigner, NetworkConfig } from "@colibri/core";
import { createColibriConfig } from "@/config.ts";
import { assertConnection, guardedSigners } from "@/signers.ts";
import {
  createFreighterConnector,
  createWalletConnector,
  createWalletEnvelopeSigner,
} from "@/wallets.ts";
import { ColibriReactError } from "@/error.ts";
const network = NetworkConfig.TestNet();
const key = LocalSigner.generateRandom();
const address = key.publicKey();
const transaction = new TransactionBuilder(new Account(address, "1"), {
  networkPassphrase: network.networkPassphrase,
  fee: "100",
}).setTimeout(0).build();
describe("wallet capabilities", () => {
  it("adapts native envelope signing with explicit authority and network", async () => {
    let calls = 0;
    const signer = createWalletEnvelopeSigner({
      publicKey: address,
      networkPassphrase: network.networkPassphrase,
      signTransaction: () => {
        calls++;
        return Promise.resolve(transaction.toXDR());
      },
    });
    assertEquals(signer.signerKey(), address);
    assert(signer.signsFor(address));
    assertEquals(signer.signsFor("C-other"), false);
    assertEquals(
      await signer.signTransaction(transaction),
      transaction.toXDR(),
    );
    assertEquals(calls, 1);
    const wrong = new TransactionBuilder(new Account(address, "1"), {
      networkPassphrase: "wrong",
      fee: "100",
    }).setTimeout(0).build();
    await assertRejects(
      () => Promise.resolve(signer.signTransaction(wrong)),
      ColibriReactError,
    );
    assertEquals(calls, 1);
  });
  it("rejects an in-flight signature after disconnect and guards every retained signer", async () => {
    let finish!: (value: string) => void;
    const wallet = createWalletConnector({
      id: "wallet",
      connect: () =>
        Promise.resolve({
          address,
          networkPassphrase: network.networkPassphrase,
          signers: [{
            signerKey: () => address,
            signsFor: () => true,
            signTransaction: () =>
              new Promise<string>((resolve) => {
                finish = resolve;
              }),
          }],
        }),
    });
    const config = createColibriConfig({ network, connectors: [wallet] });
    const connection = (await config.connect("wallet"))!;
    const signer = guardedSigners(config, connection)[0] as EnvelopeSigner;
    assertEquals(signer.signerKey(), address);
    assert(signer.signsFor(address));
    const pending = Promise.resolve(signer.signTransaction(transaction));
    await config.disconnect();
    finish(transaction.toXDR());
    await assertRejects(() => pending, ColibriReactError);
    assertThrows(() => signer.signerKey(), ColibriReactError);
    assertThrows(() => signer.signsFor(address), ColibriReactError);
    assertThrows(() => assertConnection(config, undefined), ColibriReactError);
    config.destroy();
  });
  it("preserves auth-entry and preauthorized transaction capabilities", async () => {
    const auth = {
      signsFor: () => true,
      signSorobanAuthEntry: () =>
        Promise.resolve({} as Parameters<typeof key.signSorobanAuthEntry>[0]),
    };
    const preauth = {
      signsFor: () => true,
      signerKey: () => "T-key" as const,
      authorizesTransaction: () => true,
    };
    const config = createColibriConfig({
      network,
      connectors: [{
        id: "wallet",
        connect: () =>
          Promise.resolve({
            address,
            networkPassphrase: network.networkPassphrase,
            signers: [auth, preauth],
          }),
      }],
    });
    const connection = (await config.connect("wallet"))!;
    const [a, b] = guardedSigners(config, connection);
    assert("signSorobanAuthEntry" in a);
    await a.signSorobanAuthEntry(
      {} as Parameters<typeof a.signSorobanAuthEntry>[0],
      1,
      network.networkPassphrase,
    );
    assert("authorizesTransaction" in b);
    assertEquals(await b.authorizesTransaction(transaction), true);
    config.destroy();
  });
});

describe("Freighter connector", () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
  it("connects explicitly, restores silently, and emits only changed wallet state", async () => {
    let current = address;
    let prompts = 0;
    let reads = 0;
    const api = {
      requestAccess: () => {
        prompts++;
        return Promise.resolve({ address: current });
      },
      getAddress: () => {
        reads++;
        return Promise.resolve({ address: current });
      },
      getNetworkDetails: () =>
        Promise.resolve({ networkPassphrase: network.networkPassphrase }),
      signTransaction: () =>
        Promise.resolve({
          signedTxXdr: transaction.toXDR(),
          signerAddress: address,
        }),
    };
    const connector = createFreighterConnector(api, { pollIntervalMs: 1 });
    const connection = await connector.connect();
    assertEquals(prompts, 1);
    await connector.reconnect!();
    assertEquals(prompts, 1);
    const changes: unknown[] = [];
    const stop = connector.subscribe!((value) => changes.push(value));
    await tick();
    assertEquals(changes.length, 0);
    current = LocalSigner.generateRandom().publicKey();
    await tick();
    assertEquals(changes.length, 1);
    stop();
    const before = reads;
    await tick();
    assertEquals(reads, before);
    current = address;
    const signer = connection.signers[0] as EnvelopeSigner;
    assertEquals(
      await signer.signTransaction(transaction),
      transaction.toXDR(),
    );
    current = "" as typeof address;
    assertEquals(await connector.reconnect!(), null);
    await assertRejects(() => connector.connect(), ColibriReactError);
  });
  it("preserves wallet errors and rejects invalid identity and signing changes", async () => {
    const walletError = new Error("denied");
    let current = address;
    let passphrase: string = network.networkPassphrase;
    let failure: Error | undefined;
    const api = {
      requestAccess: () =>
        Promise.resolve({ address: current, error: failure }),
      getAddress: () => Promise.resolve({ address: current, error: failure }),
      getNetworkDetails: () =>
        Promise.resolve({ networkPassphrase: passphrase, error: failure }),
      signTransaction: () =>
        Promise.resolve({
          signedTxXdr: transaction.toXDR(),
          signerAddress: current,
          error: failure,
        }),
    };
    assertThrows(
      () => createFreighterConnector(api, { pollIntervalMs: 0 }),
      ColibriReactError,
    );
    const connector = createFreighterConnector(api);
    failure = walletError;
    assertEquals(await assertRejects(() => connector.connect()), walletError);
    failure = undefined;
    current = "G-invalid";
    await assertRejects(() => connector.connect(), ColibriReactError);
    current = address;
    const connection = await connector.connect();
    const signer = connection.signers[0] as EnvelopeSigner;
    passphrase = "other";
    await assertRejects(
      () => Promise.resolve(signer.signTransaction(transaction)),
      ColibriReactError,
    );
    passphrase = network.networkPassphrase;
    api.signTransaction = () => {
      current = LocalSigner.generateRandom().publicKey();
      return Promise.resolve({
        signedTxXdr: transaction.toXDR(),
        signerAddress: current,
        error: undefined,
      });
    };
    await assertRejects(
      () => Promise.resolve(signer.signTransaction(transaction)),
      ColibriReactError,
    );
  });
});
