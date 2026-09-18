import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { Account, TransactionBuilder } from "stellar-sdk/base";
import { type EnvelopeSigner, LocalSigner, NetworkConfig } from "@colibri/core";
import { createColibriConfig } from "@/context/config.ts";
import { assertConnection, guardedSigners } from "@/signers/hooks.ts";
import {
  createWalletConnector,
  createWalletEnvelopeSigner,
} from "@/wallets/adapter.ts";
import { ColibriReactError } from "@/errors/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);
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
