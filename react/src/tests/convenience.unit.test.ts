import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createElement, StrictMode } from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, mountReact } from "colibri-internal/tests/react.ts";
import {
  LocalSigner,
  NetworkConfig,
  type Signer,
  type TransactionConfig,
} from "@colibri/core";
import { Account, Address, TransactionBuilder, xdr } from "stellar-sdk/base";
import { ColibriQueryProvider } from "@/provider/index.ts";
import { createColibriConfig } from "@/context/config.ts";
import { useWallet, type WalletState } from "@/wallet/index.ts";
import { createWalletSigner } from "@/wallets/signer/index.ts";
import { useWalletContractInvoke } from "@/contracts/invoke/wallet.ts";
import { walletTransactionConfig } from "@/wallet/transaction-config.ts";
import {
  ReactConnectionChangedError,
  ReactInvalidConfigError,
  ReactNetworkMismatchError,
  ReactUnsupportedCapabilityError,
} from "@/errors/index.ts";
const key = LocalSigner.generateRandom();
const address = key.publicKey();
const network = NetworkConfig.TestNet();
const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const connection = {
  address,
  networkPassphrase: network.networkPassphrase,
  signers: [key],
};
function fixture() {
  let prompts = 0;
  let disconnects = 0;
  const config = createColibriConfig({
    network,
    connectors: [{
      id: "wallet",
      connect: () => {
        prompts++;
        return Promise.resolve(connection);
      },
      reconnect: () => Promise.resolve(connection),
      disconnect: () => {
        disconnects++;
        return Promise.resolve();
      },
    }],
  });
  return { config, prompts: () => prompts, disconnects: () => disconnects };
}
describe("React conveniences", () => {
  it("owns isolated stable caches and preserves caller-owned caches", async () => {
    const f = fixture();
    let client!: QueryClient;
    function View() {
      client = useQueryClient();
      return createElement("span");
    }
    const render = (queryClient?: QueryClient) =>
      createElement(
        StrictMode,
        null,
        createElement(
          ColibriQueryProvider,
          { config: f.config, queryClient },
          createElement(View),
        ),
      );
    const view = await mountReact(render());
    const first = client;
    client.setQueryData(["sample"], 1);
    await act(() => view.root.render(render()));
    assertStrictEquals(client, first);
    assertEquals(client.getQueryData(["sample"]), 1);
    await view.close();
    assertEquals(first.getQueryData(["sample"]), undefined);
    const external = new QueryClient();
    external.setQueryData(["owned"], 2);
    const second = await mountReact(render(external));
    assertStrictEquals(client, external);
    await second.close();
    assertEquals(external.getQueryData(["owned"]), 2);
    external.clear();
    f.config.destroy();
  });
  it("combines wallet observation/actions without auto-connect and rejects ambiguous selection", async () => {
    const f = fixture();
    let wallet!: WalletState;
    function View() {
      wallet = useWallet();
      return createElement("span");
    }
    const view = await mountReact(
      createElement(
        ColibriQueryProvider,
        { config: f.config },
        createElement(View),
      ),
    );
    try {
      assertEquals(wallet.status, "disconnected");
      assertEquals(wallet.signers, []);
      assertEquals(f.prompts(), 0);
      await act(async () => {
        await wallet.connect();
      });
      assertEquals(wallet.address, address);
      assertEquals(f.prompts(), 1);
      const old = wallet.signers[0];
      assertEquals(old.signsFor(address), true);
      await act(async () => {
        await wallet.disconnect();
      });
      assertEquals(wallet.status, "disconnected");
      assertEquals(f.disconnects(), 1);
      assertThrows(() => old.signsFor(address), ReactConnectionChangedError);
      await act(async () => {
        await wallet.reconnect("wallet");
      });
      assertEquals(wallet.status, "connected");
      assertEquals(f.prompts(), 1);
      const ambiguous = createColibriConfig({
        network,
        connectors: [...f.config.connectors, {
          ...f.config.connectors[0],
          id: "other",
        }],
      });
      await act(() =>
        view.root.render(
          createElement(
            ColibriQueryProvider,
            { config: ambiguous },
            createElement(View),
          ),
        )
      );
      await assertRejects(() => wallet.connect(), ReactInvalidConfigError);
      await act(async () => {
        await wallet.connect("other");
      });
      assertEquals(wallet.connectorId, "other");
      await act(() => ambiguous.destroy());
    } finally {
      await view.close();
      f.config.destroy();
    }
  });
  it("routes envelope and authorization requests through one signer and preserves input", async () => {
    const calls: string[] = [];
    const signer = createWalletSigner({
      address,
      networkPassphrase: network.networkPassphrase,
      signTransaction: (value, passphrase) => {
        assertEquals(passphrase, network.networkPassphrase);
        calls.push("envelope");
        return Promise.resolve(value);
      },
      signAuthEntry: (value, passphrase) => {
        assertEquals(passphrase, network.networkPassphrase);
        calls.push("auth");
        return Promise.resolve(value);
      },
    });
    const tx = new TransactionBuilder(new Account(address, "1"), {
      fee: "100",
      networkPassphrase: network.networkPassphrase,
    }).setTimeout(0).build();
    const entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: Address.fromString(address).toScAddress(),
          nonce: 1n,
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVoid(),
        }),
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction
          .sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: Address.fromString(contractId).toScAddress(),
              functionName: "test",
              args: [],
            }),
          ),
        subInvocations: [],
      }),
    });
    const before = entry.toXdr("base64");
    assertEquals(signer.signerKey(), address);
    assertEquals(signer.signsFor(address), true);
    assertEquals(signer.signsFor(contractId), false);
    assertEquals(await signer.signTransaction(tx), tx.toXDR());
    await signer.signSorobanAuthEntry(entry, 123, network.networkPassphrase);
    assertEquals(entry.toXdr("base64"), before);
    assertEquals(calls, ["envelope", "auth"]);
    await assertRejects(
      () => signer.signSorobanAuthEntry(entry, 123, "other"),
      ReactNetworkMismatchError,
    );
  });
  it("uses the same generated client with wallet defaults, retaining explicit configuration and decoded results", async () => {
    const f = fixture();
    const captured: {
      methodArgs: { value: number };
      config?: Partial<TransactionConfig>;
    }[] = [];
    const client = {
      networkConfig: network,
      getContractId: () => contractId,
      getSpec: () => ({ entries: [] }),
      update: {
        invoke: (
          args: {
            methodArgs: { value: number };
            config: Partial<TransactionConfig>;
          },
        ) => {
          captured.push(args);
          return Promise.resolve({ result: args.methodArgs.value });
        },
      },
    };
    let invoke!: ReturnType<
      typeof useWalletContractInvoke<typeof client, "update">
    >;
    function View() {
      invoke = useWalletContractInvoke(client, "update");
      return createElement("span");
    }
    const view = await mountReact(
      createElement(
        ColibriQueryProvider,
        { config: f.config },
        createElement(View),
      ),
    );
    try {
      assertEquals(captured.length, 0);
      await act(async () => {
        await assertRejects(
          () => invoke.mutateAsync({ methodArgs: { value: 1 } }),
          ReactConnectionChangedError,
        );
      });
      await act(async () => {
        await f.config.connect("wallet");
      });
      await act(async () => {
        assertEquals(
          await invoke.mutateAsync({
            methodArgs: { value: 2 },
            config: { fee: { max: "500" }, timeout: 12 },
          }),
          { result: 2 },
        );
      });
      assertEquals(captured[0].config?.source, address);
      assertEquals(captured[0].config?.fee, { max: "500" });
      assertEquals(captured[0].config?.timeout, 12);
      const signers: Signer[] = [key];
      const explicit = { source: address, signers, timeout: 0 };
      await act(async () => {
        await f.config.disconnect();
      });
      await act(async () => {
        await invoke.mutateAsync({
          methodArgs: { value: 3 },
          config: explicit,
        });
      });
      assertStrictEquals(captured[1].config, explicit);
      assertStrictEquals(captured[1].config?.signers, signers);
      assertEquals(f.prompts(), 1);
    } finally {
      await view.close();
      f.config.destroy();
    }
  });
  it("keeps partial signer overrides and requires an explicit G source for a contract wallet", async () => {
    const f = fixture();
    await f.config.connect("wallet");
    const current = f.config.getSnapshot().connection;
    const custom: Signer[] = [];
    assertStrictEquals(
      (await walletTransactionConfig(f.config, current, { signers: custom }))
        .signers,
      custom,
    );
    assert(
      (await walletTransactionConfig(f.config, current, { source: address }))
        .signers?.length,
    );
    const cfg = createColibriConfig({
      network,
      connectors: [{
        id: "contract",
        connect: () => Promise.resolve({ ...connection, address: contractId }),
      }],
    });
    await cfg.connect("contract");
    await assertRejects(
      () => walletTransactionConfig(cfg, cfg.getSnapshot().connection),
      ReactUnsupportedCapabilityError,
    );
    assertEquals(
      (await walletTransactionConfig(cfg, cfg.getSnapshot().connection, {
        source: address,
      })).source,
      address,
    );
    f.config.destroy();
    cfg.destroy();
  });
});
