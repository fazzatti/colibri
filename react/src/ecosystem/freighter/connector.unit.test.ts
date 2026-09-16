import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Account, TransactionBuilder } from "stellar-sdk/base";
import { type EnvelopeSigner, LocalSigner, NetworkConfig } from "@colibri/core";
import { createFreighterConnector } from "@/ecosystem/freighter/connector.ts";
import { ColibriReactError } from "@/errors/index.ts";
import type { FreighterApi } from "@/ecosystem/freighter/types.ts";
const network = NetworkConfig.TestNet();
const key = LocalSigner.generateRandom();
const address = key.publicKey();
const transaction = new TransactionBuilder(new Account(address, "1"), {
  networkPassphrase: network.networkPassphrase,
  fee: "100",
}).setTimeout(0).build();
describe("Freighter connector", () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
  it("preserves errors at discovery and signing boundaries and detects post-prompt network changes", async () => {
    const denied = new Error("wallet unavailable");
    let phase = "none";
    let passphrase: string = network.networkPassphrase;
    const api: FreighterApi = {
      requestAccess: () => Promise.resolve({ address }),
      getAddress: () =>
        Promise.resolve({
          address,
          error: phase === "account" ? denied : undefined,
        }),
      getNetworkDetails: () =>
        Promise.resolve({
          networkPassphrase: passphrase,
          network: "TESTNET",
          networkUrl: "https://horizon-testnet.stellar.org",
          error: phase === "network" ? denied : undefined,
        }),
      signTransaction: () => {
        if (phase === "switch") passphrase = "different";
        return Promise.resolve({
          signedTxXdr: transaction.toXDR(),
          signerAddress: address,
          error: phase === "signature" ? denied : undefined,
        });
      },
    };
    const connector = createFreighterConnector(api);
    phase = "network";
    assertEquals(await assertRejects(() => connector.connect()), denied);
    phase = "none";
    const signer = (await connector.connect()).signers[0] as EnvelopeSigner;
    for (phase of ["account", "network", "signature"]) {
      assertEquals(
        await assertRejects(() =>
          Promise.resolve(signer.signTransaction(transaction))
        ),
        denied,
      );
    }
    phase = "switch";
    await assertRejects(
      () => Promise.resolve(signer.signTransaction(transaction)),
      ColibriReactError,
    );
  });

  it("reports failed wallet polling and ignores a failure delivered after unsubscribe", async () => {
    let fail = false;
    let reject!: (error: Error) => void;
    let resolve!: (
      value: Awaited<ReturnType<FreighterApi["getAddress"]>>,
    ) => void;
    let reads = 0;
    const api: FreighterApi = {
      requestAccess: () => Promise.resolve({ address }),
      getAddress: () => {
        reads++;
        return fail
          ? Promise.reject(new Error("wallet locked"))
          : new Promise((resolved, rejected) => {
            resolve = resolved;
            reject = rejected;
          });
      },
      getNetworkDetails: () =>
        Promise.resolve({
          network: "TESTNET",
          networkUrl: "https://horizon-testnet.stellar.org",
          networkPassphrase: network.networkPassphrase,
        }),
      signTransaction: () =>
        Promise.resolve({
          signedTxXdr: transaction.toXDR(),
          signerAddress: address,
        }),
    };
    const connector = createFreighterConnector(api, { pollIntervalMs: 1 });
    await connector.connect();
    const changes: unknown[] = [];
    fail = true;
    const stopFailed = connector.subscribe!((value) => changes.push(value));
    await tick();
    stopFailed();
    assertEquals(changes.length > 0, true);
    assertEquals(changes.every((value) => value === null), true);
    fail = false;
    const stopPending = connector.subscribe!((value) => changes.push(value));
    await tick();
    stopPending();
    const before = changes.length;
    const readCount = reads;
    reject(new Error("late lock"));
    await tick();
    assertEquals(changes.length, before);
    assertEquals(reads, readCount);
    const stopSuccess = connector.subscribe!((value) => changes.push(value));
    await tick();
    stopSuccess();
    resolve({ address });
    await tick();
    assertEquals(changes.length, before);
  });
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
        Promise.resolve({
          networkPassphrase: network.networkPassphrase,
          network: "TESTNET",
          networkUrl: "https://horizon-testnet.stellar.org",
        }),
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
    current = "" as typeof address;
    await tick();
    assertEquals(changes.length, 2);
    assertEquals(changes.at(-1), null);
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
        Promise.resolve({
          networkPassphrase: passphrase,
          network: "TESTNET",
          networkUrl: "https://horizon-testnet.stellar.org",
          error: failure,
        }),
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
