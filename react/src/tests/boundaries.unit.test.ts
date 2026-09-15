import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Account,
  Asset,
  SorobanDataBuilder,
  TransactionBuilder,
  xdr,
} from "stellar-sdk/base";
import { Api, Server } from "stellar-sdk/rpc";
import { LedgerEntries, LocalSigner, NetworkConfig } from "@colibri/core";
import { WebAuthClient } from "@colibri/webauth";
import { Demo } from "colibri-internal/tests/generated-bindings/demo/index.ts";
import { BINDINGS_DEMO_SPEC } from "colibri-internal/tests/specs/bindings-demo.ts";
import {
  act,
  mountReact,
  renderToString,
  until,
} from "colibri-internal/tests/react.ts";
import { createColibriConfig } from "@/context/config.ts";
import { ColibriProvider } from "@/context/provider.ts";
import { useAccount, useTrustline } from "@/accounts/hooks.ts";
import { useRpc, useTransaction, useWaitForTransaction } from "@/rpc/hooks.ts";
import { useContractInvoke } from "@/contracts/invoke/hooks.ts";
import {
  contractReadQueryOptions,
  useContractReadSpec,
} from "@/contracts/read/hooks.ts";
import {
  createContractEvents,
  useContractEvents,
} from "@/events/subscription.ts";
import { createWebAuthSession, useSession } from "@/webauth/hooks.ts";
import { useSignMessage } from "@/signers/hooks.ts";
import { useSimulateSorobanTransaction } from "@/transactions/simulation/hook.ts";
import { useIdenticon } from "@/identicon/hooks.ts";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.generateRandom();
const address = signer.publicKey();
const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
function environment() {
  const config = createColibriConfig({ network });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return {
    config,
    client,
    wrap: (Component: () => ReturnType<typeof createElement>) =>
      createElement(
        QueryClientProvider,
        { client },
        createElement(ColibriProvider, { config }, createElement(Component)),
      ),
  };
}

describe("React feature boundaries", () => {
  it("uses HTTPS by default and reports malformed JavaScript trustline inputs before RPC", async () => {
    const config = createColibriConfig({
      network: NetworkConfig.CustomNet({
        networkPassphrase: "custom",
        rpcUrl: "https://rpc.example.org",
      }),
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    using requests = stub(Server.prototype, "getLedgerEntries", () => {
      throw new Error("Malformed input must not reach RPC");
    });
    let query!: ReturnType<typeof useTrustline>;
    const Component = () => {
      assertEquals(useRpc().serverURL.protocol, "https:");
      query = useTrustline(
        { accountId: address } as Parameters<typeof useTrustline>[0],
      );
      return createElement("div");
    };
    const view = await mountReact(
      createElement(
        QueryClientProvider,
        { client },
        createElement(ColibriProvider, { config }, createElement(Component)),
      ),
    );
    try {
      await until(() => query.isError);
      assertEquals(query.error instanceof TypeError, true);
      assertEquals(requests.calls.length, 0);
    } finally {
      await view.close();
      client.clear();
      config.destroy();
    }
  });
  it("keeps absent and explicitly disabled account, trustline and transaction queries idle", async () => {
    const env = environment();
    const fail = () => {
      throw new Error("Disabled query made a request");
    };
    using accounts = stub(LedgerEntries.prototype, "account", fail);
    using trustlines = stub(LedgerEntries.prototype, "trustline", fail);
    using transactions = stub(Server.prototype, "getTransaction", fail);
    const Component = () => {
      const results = [
        useAccount(undefined),
        useAccount(address, { enabled: false }),
        useTrustline(undefined),
        useTrustline({ accountId: address, asset: new Asset("USD", address) }, {
          enabled: false,
        }),
        useTransaction(undefined),
        useTransaction("a".repeat(64), { enabled: false }),
      ];
      assertEquals(
        results.map((result) => result.fetchStatus),
        Array(6).fill("idle"),
      );
      assertEquals(useIdenticon(undefined), undefined);
      return createElement("div");
    };
    const view = await mountReact(env.wrap(Component));
    try {
      assertEquals([
        accounts.calls.length,
        trustlines.calls.length,
        transactions.calls.length,
      ], [0, 0, 0]);
    } finally {
      await view.close();
      env.client.clear();
      env.config.destroy();
    }
  });

  it("rejects missing RPC configuration and cross-provider session/event stores", () => {
    const owner = createColibriConfig({ network });
    const other = createColibriConfig({
      network: NetworkConfig.CustomNet({ networkPassphrase: "other" }),
    });
    const events = createContractEvents(owner);
    const session = createWebAuthSession(
      owner,
      new WebAuthClient({
        network,
        homeDomain: "example.org",
        signingKey: address,
        sep10: { endpoint: "https://example.org/auth" },
      }),
    );
    const components = [
      () => {
        useRpc();
        return createElement("div");
      },
      () => {
        useSession(session);
        return createElement("div");
      },
      () => {
        useContractEvents(events);
        return createElement("div");
      },
    ];
    try {
      for (const Component of components) {
        const error = assertThrows(
          () =>
            renderToString(
              createElement(
                ColibriProvider,
                { config: other },
                createElement(Component),
              ),
            ),
          ColibriReactError,
        );
        assertEquals(error.code, ReactCode.INVALID_CONFIG);
      }
    } finally {
      session.destroy();
      events.destroy();
      owner.destroy();
      other.destroy();
    }
  });

  it("rejects wrong-network clients and missing invocation helpers before any wallet request", async () => {
    const env = environment();
    const contract = new Demo({
      networkConfig: NetworkConfig.MainNet(),
      contractConfig: { contractId },
    });
    assertThrows(
      () =>
        contractReadQueryOptions(env.config, {
          contract,
          method: "getCount",
          args: [],
        }),
      ColibriReactError,
    );
    let invoke!: ReturnType<typeof useContractInvoke<Demo, "increment">>;
    let wrongNetwork!: typeof invoke;
    const local = new Demo({
      networkConfig: network,
      contractConfig: { contractId },
    });
    const Component = () => {
      wrongNetwork = useContractInvoke(contract, "increment");
      invoke = useContractInvoke(local, "missing" as "increment");
      return createElement("div");
    };
    const view = await mountReact(env.wrap(Component));
    const args: Parameters<Demo["increment"]["invoke"]>[0] = {
      methodArgs: { by: 1 },
      config: {
        source: address,
        fee: "100" as const,
        timeout: 30,
        signers: [],
      },
    };
    try {
      await act(async () => {
        const mismatch = await assertRejects(
          () => wrongNetwork.mutateAsync(args),
          ColibriReactError,
        );
        assertEquals(mismatch.code, ReactCode.NETWORK_MISMATCH);
        const missing = await assertRejects(
          () => invoke.mutateAsync(args),
          ColibriReactError,
        );
        assertEquals(missing.code, ReactCode.INVALID_METHOD);
      });
    } finally {
      await view.close();
      env.client.clear();
      env.config.destroy();
    }
  });

  it("simulates through Core and returns undecorated spec reads without signing or submitting", async () => {
    const env = environment();
    using simulations = stub(
      Server.prototype,
      "simulateTransaction",
      () =>
        Promise.resolve({
          _parsed: true,
          id: "simulation",
          latestLedger: 1,
          minResourceFee: "100",
          transactionData: new SorobanDataBuilder(),
          events: [],
          result: { auth: [], retval: xdr.ScVal.scvU32(7) },
        }),
    );
    using sends = stub(Server.prototype, "sendTransaction", () => {
      throw new Error("Simulation submitted a transaction");
    });
    let read!: ReturnType<typeof useContractReadSpec>;
    let simulate!: ReturnType<typeof useSimulateSorobanTransaction>;
    const Component = () => {
      read = useContractReadSpec({
        contractId,
        spec: BINDINGS_DEMO_SPEC,
        method: "get_count",
      });
      simulate = useSimulateSorobanTransaction();
      return createElement("div");
    };
    const view = await mountReact(env.wrap(Component));
    try {
      await until(() => read.isSuccess);
      assertEquals(Number(read.data), 7);
      const transaction = new TransactionBuilder(new Account(address, "1"), {
        networkPassphrase: network.networkPassphrase,
        fee: "100",
      }).setTimeout(0).build();
      await act(async () => {
        const result = await simulate.mutateAsync(transaction);
        assertEquals(
          result.result?.retval.toXdr("base64"),
          xdr.ScVal.scvU32(7).toXdr("base64"),
        );
      });
      assertEquals(simulations.calls.length, 2);
      assertEquals(sends.calls.length, 0);
    } finally {
      await view.close();
      env.client.clear();
      env.config.destroy();
    }
  });

  it("requires message capability and discards an approved message after disconnect", async () => {
    const env = environment();
    let finish!: (value: Uint8Array) => void;
    const config = createColibriConfig({
      network,
      connectors: [{
        id: "readonly",
        connect: () =>
          Promise.resolve({
            address,
            networkPassphrase: network.networkPassphrase,
            signers: [],
          }),
      }, {
        id: "message",
        connect: () =>
          Promise.resolve({
            address,
            networkPassphrase: network.networkPassphrase,
            signers: [],
            messageSigner: {
              publicKey: () => address,
              signMessage: () =>
                new Promise<Uint8Array>((resolve) => {
                  finish = resolve;
                }),
            },
          }),
      }],
    });
    let message!: ReturnType<typeof useSignMessage>;
    const Component = () => {
      message = useSignMessage();
      return createElement("div");
    };
    const view = await mountReact(
      createElement(
        QueryClientProvider,
        { client: env.client },
        createElement(ColibriProvider, { config }, createElement(Component)),
      ),
    );
    try {
      await act(async () => {
        await config.connect("readonly");
      });
      await act(async () => {
        const error = await assertRejects(
          () => message.mutateAsync("hello"),
          ColibriReactError,
        );
        assertEquals(error.code, ReactCode.UNSUPPORTED_CAPABILITY);
      });
      await act(async () => {
        await config.connect("message");
      });
      await act(async () => {
        const pending = message.mutateAsync("hello");
        // Let the mutation reach the external wallet before disconnecting.
        for (let i = 0; !finish && i < 20; i++) await Promise.resolve();
        assertEquals(typeof finish, "function");
        await config.disconnect();
        finish(new Uint8Array([1]));
        const error = await assertRejects(() => pending, ColibriReactError);
        assertEquals(error.code, ReactCode.CONNECTION_CHANGED);
      });
    } finally {
      await view.close();
      config.destroy();
      env.client.clear();
      env.config.destroy();
    }
  });

  for (
    const status of [
      Api.GetTransactionStatus.SUCCESS,
      Api.GetTransactionStatus.FAILED,
    ]
  ) {
    it(`observes NOT_FOUND followed by terminal ${status} through explicit reads`, async () => {
      const env = environment();
      let terminal = false;
      using requests = stub(
        Server.prototype,
        "getTransaction",
        () =>
          Promise.resolve(
            {
              status: terminal ? status : Api.GetTransactionStatus.NOT_FOUND,
              txHash: "a".repeat(64),
            } as Api.GetTransactionResponse,
          ),
      );
      let query!: ReturnType<typeof useWaitForTransaction>;
      const Component = () => {
        query = useWaitForTransaction("a".repeat(64));
        return createElement("div");
      };
      const view = await mountReact(env.wrap(Component));
      try {
        await until(() =>
          query.data?.status === Api.GetTransactionStatus.NOT_FOUND
        );
        terminal = true;
        await act(async () => {
          await query.refetch();
        });
        await until(() => query.data?.status === status);
        const calls = requests.calls.length;
        assertEquals(calls, 2);
        assertEquals(requests.calls.length, calls);
      } finally {
        await view.close();
        env.client.clear();
        env.config.destroy();
      }
    });
  }
});
