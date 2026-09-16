import { WebAuthClient, WebAuthToken } from "@colibri/webauth";
import { LocalSigner } from "@colibri/core";
import { Demo } from "colibri-internal/tests/generated-bindings/demo/index.ts";
import {
  useConnect,
  useDisconnect,
  useReconnect,
} from "@/context/connection.ts";
import { useSigners } from "@/signers/hooks.ts";
import {
  createWebAuthSession,
  useSession,
  useWebAuth,
  useWebAuthClient,
} from "@/webauth/hooks.ts";
import { useContract } from "@/contracts/instance.ts";
import { useContractInvoke } from "@/contracts/invoke/hooks.ts";
import {
  contractReadQueryOptions,
  useContractRead,
} from "@/contracts/read/hooks.ts";
import { useSorobanTransaction } from "@/transactions/soroban/hook.ts";
import {
  createContractEvents,
  useContractEvents,
} from "@/events/subscription.ts";
import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
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
import {
  type AccountLedgerEntry,
  LedgerEntries,
  NetworkConfig,
  SEP41TokenContract,
  StellarToml,
  type TrustlineLedgerEntry,
} from "@colibri/core";
import { BINDINGS_DEMO_SPEC } from "colibri-internal/tests/specs/bindings-demo.ts";
import {
  act,
  mountReact,
  renderToString,
  until,
} from "colibri-internal/tests/react.ts";
import { createColibriConfig } from "@/context/config.ts";
import {
  ColibriProvider,
  useColibriConfig,
  useConnection,
  useNetwork,
} from "@/context/provider.ts";
import {
  useAccount,
  useLedgerEntries,
  useTrustline,
} from "@/accounts/hooks.ts";
import { useBalance, useTokenMetadata } from "@/assets/hooks.ts";
import { useLatestLedger, useRpc, useTransaction } from "@/rpc/hooks.ts";
import { useStellarToml } from "@/discovery/sep1/hook.ts";
import { AccountIdenticon, useIdenticon } from "@/identicon/hooks.ts";
import { useContractReadSpec } from "@/contracts/read/hooks.ts";
import { useClassicTransaction } from "@/transactions/classic/hook.ts";
import { useSimulateSorobanTransaction } from "@/transactions/simulation/hook.ts";
import { useSignMessage } from "@/signers/hooks.ts";
import { ColibriReactError } from "@/errors/index.ts";
import type { ClassicTransactionPipeline } from "@colibri/core/classic-transaction";
const address = "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO";
const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const network = NetworkConfig.TestNet();
function environment() {
  const config = createColibriConfig({ network });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: 5, gcTime: Infinity },
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
describe("React feature hooks", () => {
  it("renders deterministic SSR and validates provider boundaries", async () => {
    const config = createColibriConfig({
      network,
      connectors: [{
        id: "wallet",
        connect: () =>
          Promise.resolve({
            address,
            networkPassphrase: network.networkPassphrase,
            signers: [],
          }),
      }],
    });
    await config.connect("wallet");
    const Component = () => createElement("span", null, useConnection().status);
    assertEquals(
      renderToString(
        createElement(ColibriProvider, { config }, createElement(Component)),
      ),
      "<span>disconnected</span>",
    );
    assertThrows(
      () => renderToString(createElement(Component)),
      ColibriReactError,
    );
    config.destroy();
  });
  it("reads Classic/SEP-41 data and keeps native client identity stable", async () => {
    const env = environment();
    let reads!: ReturnType<typeof useAccount>;
    let trustline!: ReturnType<typeof useTrustline>;
    let xlm!: ReturnType<typeof useBalance>;
    let classic!: ReturnType<typeof useBalance>;
    let token!: ReturnType<typeof useBalance>;
    let metadata!: ReturnType<typeof useTokenMetadata>;
    let latest!: ReturnType<typeof useLatestLedger>;
    let transaction!: ReturnType<typeof useTransaction>;
    let toml!: ReturnType<typeof useStellarToml>;
    let oldRpc: Server | undefined;
    let oldReader: LedgerEntries | undefined;
    using account = stub(
      LedgerEntries.prototype,
      "account",
      () =>
        Promise.resolve(
          { balance: 12345678901234567890n } as AccountLedgerEntry,
        ),
    );
    using trust = stub(
      LedgerEntries.prototype,
      "trustline",
      () => Promise.resolve({ balance: 9n } as TrustlineLedgerEntry),
    );
    using _balance = stub(
      SEP41TokenContract.prototype,
      "balance",
      () => Promise.resolve(88n),
    );
    using _decimals = stub(
      SEP41TokenContract.prototype,
      "decimals",
      () => Promise.resolve(9),
    );
    using _name = stub(
      SEP41TokenContract.prototype,
      "name",
      () => Promise.resolve("Token"),
    );
    using _symbol = stub(
      SEP41TokenContract.prototype,
      "symbol",
      () => Promise.resolve("TOK"),
    );
    using _ledger = stub(
      Server.prototype,
      "getLatestLedger",
      () =>
        Promise.resolve({
          sequence: 10,
          id: "x",
          protocolVersion: "27",
          closeTime: "1",
          headerXdr: {} as xdr.LedgerHeader,
          metadataXdr: {} as xdr.LedgerCloseMeta,
        }),
    );
    using _transaction = stub(
      Server.prototype,
      "getTransaction",
      () =>
        Promise.resolve({
          status: Api.GetTransactionStatus.NOT_FOUND,
          txHash: "a".repeat(64),
          latestLedger: 10,
          latestLedgerCloseTime: 1,
          oldestLedger: 1,
          oldestLedgerCloseTime: 1,
        }),
    );
    using _toml = stub(
      StellarToml,
      "fromDomain",
      () => Promise.resolve(StellarToml.fromString('VERSION="2.0.0"')),
    );
    const Component = () => {
      const rpc = useRpc();
      const reader = useLedgerEntries();
      if (oldRpc) assertEquals(rpc, oldRpc);
      if (oldReader) assertEquals(reader, oldReader);
      oldRpc = rpc;
      oldReader = reader;
      assertEquals(useNetwork(), env.config.network);
      assertEquals(useColibriConfig(), env.config);
      reads = useAccount(address);
      trustline = useTrustline({
        accountId: address,
        asset: new Asset("USD", address),
      });
      xlm = useBalance({ kind: "xlm" }, address);
      classic = useBalance(
        { kind: "classic", code: "USD", issuer: address },
        address,
      );
      token = useBalance({ kind: "sep41", contractId }, contractId);
      metadata = useTokenMetadata(contractId);
      latest = useLatestLedger();
      transaction = useTransaction("a".repeat(64));
      toml = useStellarToml("example.org");
      const src = useIdenticon(address);
      return createElement(
        "div",
        null,
        createElement("img", { src, alt: "" }),
        createElement(AccountIdenticon, { address, alt: "Account" }),
      );
    };
    const view = await mountReact(env.wrap(Component));
    try {
      await until(() =>
        [
          reads,
          trustline,
          xlm,
          classic,
          token,
          metadata,
          latest,
          transaction,
          toml,
        ].every((q) => q.isSuccess)
      );
      assertEquals(xlm.data!.raw, 12345678901234567890n);
      assertEquals(classic.data!.decimals, 7);
      assertEquals(token.data!.raw, 88n);
      assertEquals(token.data!.decimals, 9);
      assertEquals(metadata.data!.symbol, "TOK");
      assertEquals(
        _decimals.calls.length,
        1,
        "balance and metadata share precision",
      );
      await act(async () => {
        await token.refetch();
      });
      assertEquals(
        _decimals.calls.length,
        1,
        "balance refresh reuses precision",
      );
      assertEquals(
        trust.calls[0].args[0].asset?.toString(),
        new Asset("USD", address).toString(),
      );
      assertEquals(account.calls.length, 2);
      assertEquals(view.document.querySelectorAll("img").length, 2);
    } finally {
      await view.close();
      env.client.clear();
      env.config.destroy();
    }
  });
  it("shares canonical simulation data while decoding separately for each observer", async () => {
    const env = environment();
    let a!: ReturnType<typeof useContractReadSpec<number>>;
    let b!: ReturnType<typeof useContractReadSpec<string>>;
    using simulation = stub(
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
    const request = {
      contractId,
      spec: BINDINGS_DEMO_SPEC,
      method: "get_count",
    } as const;
    const Component = () => {
      a = useContractReadSpec(request, Number);
      b = useContractReadSpec(request, (value) => `count:${Number(value)}`);
      return createElement("div");
    };
    const view = await mountReact(env.wrap(Component));
    try {
      await until(() => a.isSuccess && b.isSuccess);
      assertEquals(a.data, 7);
      assertEquals(b.data, "count:7");
      assertEquals(simulation.calls.length, 1);
      assertEquals(simulation.calls[0].args[0].operations.length, 1);
    } finally {
      await view.close();
      env.client.clear();
      env.config.destroy();
    }
  });
  it("never retries a caller pipeline, checks simulation network, and requires message capability", async () => {
    const env = environment();
    const original = new Error("wallet rejected");
    let calls = 0;
    let mutation!: ReturnType<typeof useClassicTransaction>;
    let simulate!: ReturnType<typeof useSimulateSorobanTransaction>;
    let message!: ReturnType<typeof useSignMessage>;
    const pipeline = (() => {
      calls++;
      return Promise.reject(original);
    }) as unknown as ClassicTransactionPipeline;
    const Component = () => {
      mutation = useClassicTransaction({ pipeline });
      simulate = useSimulateSorobanTransaction();
      message = useSignMessage();
      return createElement("div");
    };
    const view = await mountReact(env.wrap(Component));
    try {
      await act(async () => {
        const error = await assertRejects(() =>
          mutation.mutateAsync({
            operations: [],
            config: { source: address, fee: "100", timeout: 30, signers: [] },
          })
        );
        assertEquals(error, original);
      });
      assertEquals(calls, 1);
      const transaction = new TransactionBuilder(new Account(address, "1"), {
        networkPassphrase: "wrong",
        fee: "100",
      }).setTimeout(0).build();
      await act(async () => {
        await assertRejects(
          () => simulate.mutateAsync(transaction),
          ColibriReactError,
        );
        await assertRejects(
          () => message.mutateAsync("hello"),
          ColibriReactError,
        );
      });
      assert(mutation.isError || calls === 1);
    } finally {
      await view.close();
      env.client.clear();
      env.config.destroy();
    }
  });
});

describe("React connection, authentication and generated clients", () => {
  it("keeps shared session state out of mutation data and restores without prompting", async () => {
    const env = environment();
    const signer = LocalSigner.generateRandom();
    const account = signer.publicKey();
    const client = new WebAuthClient({
      network,
      homeDomain: "example.org",
      signingKey: account,
      sep10: { endpoint: "https://example.org/auth" },
    });
    const connection = {
      address: account,
      networkPassphrase: network.networkPassphrase,
      signers: [signer],
      messageSigner: {
        publicKey: () => account,
        signMessage: () => new Uint8Array([1, 2]),
      },
    };
    const config = createColibriConfig({
      network,
      connectors: [{
        id: "wallet",
        connect: () => Promise.resolve(connection),
        reconnect: () => Promise.resolve(connection),
      }],
    });
    const session = createWebAuthSession(config, client);
    using discovery = stub(
      WebAuthClient,
      "fromDomain",
      () => Promise.resolve(client),
    );
    const token = WebAuthToken.authenticated(
      `e30.${
        btoa(
          JSON.stringify({
            iss: "https://example.org/auth",
            sub: account,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 100,
          }),
        )
      }.sig`,
      {
        protocol: "sep10",
        account,
        homeDomain: "example.org",
        webAuthDomain: "example.org",
      },
    );
    using exchange = stub(client, "authenticate", () => Promise.resolve(token));
    let connect!: ReturnType<typeof useConnect>;
    let reconnect!: ReturnType<typeof useReconnect>;
    let disconnect!: ReturnType<typeof useDisconnect>;
    let signers!: ReturnType<typeof useSigners>;
    let sign!: ReturnType<typeof useSignMessage>;
    let auth!: ReturnType<typeof useWebAuth>;
    let state!: ReturnType<typeof useSession>;
    let discovered!: ReturnType<typeof useWebAuthClient>;
    const Component = () => {
      connect = useConnect();
      reconnect = useReconnect();
      disconnect = useDisconnect();
      signers = useSigners();
      sign = useSignMessage();
      auth = useWebAuth(session);
      state = useSession(session);
      discovered = useWebAuthClient("example.org");
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
      await until(() => discovered.isSuccess);
      assertEquals(discovery.calls.length, 1);
      assertEquals(signers.length, 0);
      await act(async () => {
        await connect("wallet");
      });
      assertEquals(signers.length, 1);
      await act(async () => {
        assertEquals(await sign.mutateAsync("hello"), new Uint8Array([1, 2]));
        await auth.mutateAsync({ account, signer });
      });
      assertEquals(exchange.calls.length, 1);
      await until(() => state.status === "authenticated");
      assertEquals(auth.data, undefined);
      assertEquals(state.token, token);
      await act(async () => {
        await disconnect();
      });
      assertEquals(state.status, "anonymous");
      await act(async () => {
        await reconnect("wallet");
      });
      assertEquals(config.getSnapshot().status, "connected");
    } finally {
      await view.close();
      session.destroy();
      config.destroy();
      env.client.clear();
      env.config.destroy();
    }
  });
  it("preserves generated method output and client identity and rejects unknown helpers", async () => {
    const env = environment();
    const contract = new Demo({
      networkConfig: env.config.network,
      contractConfig: { contractId },
    });
    const result = { hash: "a".repeat(64), ledger: 1 } as Awaited<
      ReturnType<Demo["increment"]["invoke"]>
    >;
    using invoke = stub(
      contract.increment,
      "invoke",
      () => Promise.resolve(result),
    );
    using read = stub(
      contract.getCount,
      "read",
      () => Promise.resolve(4 as Awaited<ReturnType<Demo["getCount"]["read"]>>),
    );
    let mutation!: ReturnType<typeof useContractInvoke<Demo, "increment">>;
    let count!: ReturnType<typeof useContractRead<Demo, "getCount">>;
    let current!: Demo;
    const Component = () => {
      current = useContract(() => contract, [contract]);
      mutation = useContractInvoke(current, "increment");
      count = useContractRead({
        contract: current,
        method: "getCount",
        args: [],
      });
      useClassicTransaction();
      useSorobanTransaction();
      return createElement("div");
    };
    const view = await mountReact(env.wrap(Component));
    try {
      await until(() => count.isSuccess);
      assertEquals(current, contract);
      assertEquals(Number(count.data), 4);
      await act(async () => {
        assertEquals(
          await mutation.mutateAsync({
            methodArgs: { by: 2 },
            config: { source: address, fee: "100", timeout: 30, signers: [] },
          }),
          result,
        );
      });
      assertEquals(invoke.calls.length, 1);
      assertEquals(read.calls.length, 1);
      const invalid = contractReadQueryOptions(env.config, {
        contract,
        method: "absent" as "getCount",
        args: [],
      });
      assertThrows(() => {
        (invalid.queryFn as () => unknown)();
      }, ColibriReactError);
    } finally {
      await view.close();
      env.client.clear();
      env.config.destroy();
    }
  });
  it("observes idle event stores without starting during server rendering", () => {
    const config = createColibriConfig({ network });
    const events = createContractEvents(config);
    const Component = () =>
      createElement("span", null, useContractEvents(events).status);
    assertEquals(
      renderToString(
        createElement(ColibriProvider, { config }, createElement(Component)),
      ),
      "<span>idle</span>",
    );
    events.destroy();
    config.destroy();
  });
});
