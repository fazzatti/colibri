import { ColibriQueryProvider } from "@colibri/react/provider";
import { useWallet } from "@colibri/react/wallet";
/// <reference lib="dom" />
/** Interactive fixture driven by Playwright against installed public entrypoints. */
// @deno-types="npm:@types/react@^19.1.13"
import { createElement as h, StrictMode, useState } from "npm:react@^19.1.1";
// @deno-types="npm:@types/react-dom@^19.1.9/client"
import { createRoot } from "npm:react-dom@^19.1.1/client";
import { dehydrate, QueryClient } from "npm:@tanstack/react-query@^5.87.4";
import { NetworkConfig } from "@colibri/core/network";
import { Account, Operation, TransactionBuilder } from "stellar-sdk/base";
import {
  type EnvelopeSigner,
  isEnvelopeSigner,
  LocalSigner,
} from "@colibri/core";
import { WebAuthClient, WebAuthToken } from "@colibri/webauth";
import { createColibriConfig, type WalletConnection } from "@colibri/react";
import { useTransaction, useWaitForTransaction } from "@colibri/react/rpc";
import { useSignMessage } from "@colibri/react/signers";
import {
  createWebAuthSession,
  useSession,
  useWebAuth,
  type WebAuthSession,
} from "@colibri/react/webauth";

if (typeof document !== "undefined") {
  const signer = LocalSigner.generateRandom();
  const address = signer.publicKey();
  const network = NetworkConfig.CustomNet({
    networkPassphrase: "browser-fixture",
    rpcUrl: `${location.origin}/react-rpc`,
    allowHttp: true,
  });
  let connectCalls = 0;
  let signCalls = 0;
  let subscriptions = 0;
  let approve: (() => void) | undefined;
  let rejectConnection: (() => void) | undefined;
  let approveMessage: (() => void) | undefined;
  let rejectMessage: (() => void) | undefined;
  let approveChallenge: (() => void) | undefined;
  let rejectChallenge: (() => void) | undefined;
  let challengePrompts = 0;
  let tokenExchanges = 0;
  const authSigner: EnvelopeSigner = {
    signerKey: signer.signerKey,
    signsFor: signer.signsFor,
    signTransaction: (tx) => {
      challengePrompts++;
      return new Promise((resolve, reject) => {
        approveChallenge = () => resolve(signer.signTransaction(tx));
        rejectChallenge = () => reject(new Error("User rejected challenge"));
      });
    },
  };
  let changed: ((value: WalletConnection | null) => void) | undefined;
  const wallet = {
    id: "browser-wallet",
    connect: () => {
      connectCalls++;
      return new Promise<WalletConnection>((resolve, reject) => {
        approve = () =>
          resolve({
            address,
            networkPassphrase: network.networkPassphrase,
            signers: [authSigner],
            messageSigner: {
              publicKey: () => address,
              signMessage: () => {
                signCalls++;
                return new Promise<Uint8Array>((done, fail) => {
                  approveMessage = () => done(new Uint8Array([1, 2]));
                  rejectMessage = () =>
                    fail(new Error("User rejected signature"));
                });
              },
            },
          });
        rejectConnection = () => reject(new Error("User rejected connection"));
      });
    },
    subscribe: (listener: (value: WalletConnection | null) => void) => {
      subscriptions++;
      changed = listener;
      return () => {
        subscriptions--;
        changed = undefined;
      };
    },
  };
  const configs = ["first", "second"].map((scope) =>
    createColibriConfig({ network, connectors: [wallet], scope })
  );
  // The server boundary is controlled; challenge validation, asynchronous
  // wallet signing, token exchange and React session behavior are real.
  const serverSigner = LocalSigner.generateRandom();
  const authClient = new WebAuthClient({
    network,
    homeDomain: "example.org",
    signingKey: serverSigner.publicKey(),
    sep10: { endpoint: "https://example.org/auth" },
    fetch: (input, init) => {
      if (new Request(input, init).method === "POST") {
        tokenExchanges++;
        return Promise.resolve(Response.json({ token: credential.token }));
      }
      const now = Math.floor(Date.now() / 1000);
      const challenge = new TransactionBuilder(
        new Account(serverSigner.publicKey(), "-1"),
        {
          networkPassphrase: network.networkPassphrase,
          fee: "100",
          timebounds: { minTime: now - 1, maxTime: now + 900 },
        },
      ).addOperation(
        Operation.manageData({
          source: address,
          name: "example.org auth",
          value: btoa("n".repeat(48)),
        }),
      )
        .addOperation(
          Operation.manageData({
            source: serverSigner.publicKey(),
            name: "web_auth_domain",
            value: "example.org",
          }),
        ).build();
      return Promise.resolve(
        Response.json({ transaction: serverSigner.signTransaction(challenge) }),
      );
    },
  });
  const credential = WebAuthToken.authenticated(
    `e30.${
      btoa(
        JSON.stringify({
          iss: "https://example.org/auth",
          sub: address,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 120,
        }),
      )
    }.browser-fixture`,
    {
      protocol: "sep10",
      account: address,
      homeDomain: "example.org",
      webAuthDomain: "example.org",
    },
  );
  const sessions = configs.map((config) =>
    createWebAuthSession(config, authClient)
  );
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: 3, gcTime: Infinity },
    },
  });
  const element = document.createElement("section");
  element.id = "react-browser-fixture";
  document.body.append(element);
  const root = createRoot(element);
  function ReadObserver({ name, hash }: { name: string; hash?: string }) {
    const query = useTransaction(hash);
    return h(
      "section",
      { "data-testid": name },
      h(
        "output",
        null,
        `${query.status}:${query.fetchStatus}:${query.data?.status ?? ""}`,
      ),
      h("button", { onClick: () => void query.refetch() }, `Refresh ${name}`),
    );
  }
  function Controls({ session }: { session: WebAuthSession }) {
    const connection = useWallet();
    const { connect, disconnect } = connection;
    const message = useSignMessage();
    const authentication = useWebAuth(session);
    const sessionState = useSession(session);
    const [error, setError] = useState("");
    const [hash, setHash] = useState<string>();
    const [poll, setPoll] = useState<string>();
    const transaction = useWaitForTransaction(poll);
    const handle = async (action: () => Promise<unknown>) => {
      setError("");
      try {
        await action();
      } catch (cause) {
        setError(String(cause));
      }
    };
    return h(
      "div",
      null,
      h(
        "output",
        { "data-testid": "connection" },
        `${connection.status}:${connection.connection?.address ?? ""}`,
      ),
      h("button", {
        disabled: connection.status === "connecting",
        onClick: () => void handle(() => connect(wallet.id)),
      }, "Connect"),
      h("button", { onClick: () => void handle(disconnect) }, "Disconnect"),
      h("button", {
        onClick: () =>
          void handle(() => message.mutateAsync("browser-message")),
      }, "Sign message"),
      h(
        "output",
        { "data-testid": "message" },
        `${message.status}:${message.data?.length ?? 0}`,
      ),
      h("output", { role: "alert" }, error),
      h("button", {
        onClick: () =>
          void handle(() =>
            authentication.mutateAsync({
              account: address,
              signer: connection.signers.find(isEnvelopeSigner)!,
            })
          ),
      }, "Authenticate"),
      h("output", { "data-testid": "session" }, sessionState.status),
      h("button", { onClick: () => setHash("b".repeat(64)) }, "Enable reads"),
      h(ReadObserver, { name: "read-one", hash }),
      h(ReadObserver, { name: "read-two", hash }),
      h("button", { onClick: () => setPoll("c".repeat(64)) }, "Track success"),
      h("button", { onClick: () => setPoll("d".repeat(64)) }, "Track failure"),
      h("button", { onClick: () => setPoll("a".repeat(64)) }, "Track pending"),
      h(
        "output",
        { "data-testid": "transaction" },
        transaction.data?.status ?? "idle",
      ),
    );
  }
  function App() {
    const [selected, setSelected] = useState(0);
    return h(
      ColibriQueryProvider,
      { config: configs[selected], queryClient: client },
      h(
        "div",
        null,
        h("button", { onClick: () => setSelected(1) }, "Change provider"),
        h(Controls, { session: sessions[selected] }),
      ),
    );
  }
  root.render(h(StrictMode, null, h(App)));
  Object.assign(globalThis, {
    colibriReactFixture: {
      approve: () => approve?.(),
      reject: () => rejectConnection?.(),
      approveMessage: () => approveMessage?.(),
      approveChallenge: () => approveChallenge?.(),
      rejectChallenge: () => rejectChallenge?.(),
      authCounts: () => ({ challengePrompts, tokenExchanges }),
      logout: () => sessions.forEach((session) => session.logout()),
      rejectMessage: () => rejectMessage?.(),
      disconnectNotification: () => {
        const stale = changed;
        stale?.(null);
        // A queued event from the released observer must not restore authority.
        stale?.({
          address,
          networkPassphrase: network.networkPassphrase,
          signers: [],
        });
      },
      changeNetwork: () =>
        changed?.({ address, networkPassphrase: "wrong", signers: [] }),
      counts: () => ({ connectCalls, signCalls, subscriptions }),
      credentialsStayPrivate: () => {
        const token = credential.token;
        const values = [
          JSON.stringify(dehydrate(client, {
            shouldDehydrateMutation: () => true,
          })),
          JSON.stringify({ ...localStorage }),
          JSON.stringify({ ...sessionStorage }),
          document.body.innerHTML,
        ];
        return values.every((value) => !value.includes(token));
      },
      unmount: () => {
        root.unmount();
        sessions.forEach((session) => session.destroy());
        configs.forEach((config) => config.destroy());
        client.clear();
      },
    },
  });
}
