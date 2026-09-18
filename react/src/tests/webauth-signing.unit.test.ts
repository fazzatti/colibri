import { assert, assertEquals, assertRejects } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { createElement } from "react";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { isEnvelopeSigner, LocalSigner, NetworkConfig } from "@colibri/core";
import { WebAuthClient } from "@colibri/webauth";
import {
  buildSep10Challenge,
  createWebAuthFixture,
  testJwt,
} from "colibri-internal/tests/helpers/webauth/fixtures.ts";
import { act, mountReact, until } from "colibri-internal/tests/react.ts";
import {
  createColibriConfig,
  type WalletConnection,
} from "@/context/config.ts";
import { ColibriQueryProvider } from "@/provider/index.ts";
import { useWallet } from "@/wallet/index.ts";
import {
  createWebAuthSession,
  useSession,
  useWebAuth,
} from "@/webauth/hooks.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("React asynchronous SEP-10 wallet approval", () => {
  for (
    const invalidation of [
      "none",
      "logout",
      "disconnect",
      "account",
      "network",
      "dispose session",
      "dispose config",
      "abort",
    ] as const
  ) {
    it(`keeps the real exchange and session bound to approval: ${invalidation}`, async () => {
      const fixture = createWebAuthFixture();
      const local = LocalSigner.fromKeypair(fixture.client);
      const prompted = Promise.withResolvers<void>();
      const approval = Promise.withResolvers<void>();
      let notify!: (value: WalletConnection | null) => void;
      const connection: WalletConnection = {
        address: fixture.client.publicKey(),
        networkPassphrase: fixture.networkPassphrase,
        signers: [{
          signerKey: local.signerKey,
          signsFor: local.signsFor,
          signTransaction: async (tx) => {
            prompted.resolve();
            await approval.promise;
            return local.signTransaction(tx);
          },
        }],
      };
      const config = createColibriConfig({
        network: NetworkConfig.TestNet(),
        connectors: [{
          id: "wallet",
          connect: () => Promise.resolve(connection),
          subscribe: (listener) => {
            notify = listener;
            return () => {};
          },
        }],
      });
      let posts = 0;
      const client = new WebAuthClient({
        homeDomain: fixture.homeDomain,
        signingKey: fixture.server.publicKey(),
        network: config.network,
        sep10: { endpoint: `https://${fixture.webAuthDomain}/auth` },
        fetch: (input, init) => {
          if (new Request(input, init).method === "GET") {
            return Promise.resolve(
              Response.json({ transaction: buildSep10Challenge(fixture) }),
            );
          }
          posts++;
          return Promise.resolve(Response.json({
            token: testJwt({
              iss: `https://${fixture.webAuthDomain}/auth`,
              sub: fixture.client.publicKey(),
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 900,
            }),
          }));
        },
      });
      const session = createWebAuthSession(config, client);
      const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
      });
      const controller = new AbortController();
      let wallet!: ReturnType<typeof useWallet>;
      let authentication!: ReturnType<typeof useWebAuth>;
      let state!: ReturnType<typeof useSession>;
      const Application = () => {
        wallet = useWallet();
        authentication = useWebAuth(session);
        state = useSession(session);
        return createElement("output", null, state.status);
      };
      await config.connect("wallet");
      const view = await mountReact(
        createElement(
          ColibriQueryProvider,
          { config, queryClient },
          createElement(Application),
        ),
      );
      try {
        let pending!: Promise<void>;
        await act(async () => {
          const signer = wallet.signers.find(isEnvelopeSigner);
          assert(signer);
          pending = authentication.mutateAsync({
            account: connection.address,
            signer,
            ...(invalidation === "abort" ? { signal: controller.signal } : {}),
          });
          void pending.catch(() => {});
          await prompted.promise;
        });
        assertEquals(state.status, "authenticating");
        assertEquals(posts, 0);
        await act(async () => {
          if (invalidation === "logout") session.logout();
          if (invalidation === "disconnect") await config.disconnect();
          if (invalidation === "account") {
            notify({ ...connection, address: fixture.server.publicKey() });
          }
          if (invalidation === "network") {
            notify({ ...connection, networkPassphrase: "another network" });
          }
          if (invalidation === "dispose session") session.destroy();
          if (invalidation === "dispose config") config.destroy();
          if (invalidation === "abort") {
            controller.abort(new Error("caller cancelled"));
          }
          approval.resolve();
          if (invalidation === "none") await pending;
          else await assertRejects(() => pending);
        });
        await until(() => state.status !== "authenticating");
        assertEquals(posts, invalidation === "none" ? 1 : 0);
        assertEquals(
          state.status,
          invalidation === "none" ? "authenticated" : "anonymous",
        );
        assertEquals(authentication.data, undefined);
        const token = session.getSnapshot().token?.token;
        if (token) {
          assert(
            !JSON.stringify(
              dehydrate(queryClient, { shouldDehydrateMutation: () => true }),
            ).includes(token),
          );
          assert(!view.document.body.innerHTML.includes(token));
        }
      } finally {
        approval.resolve();
        await view.close();
        session.destroy();
        config.destroy();
        queryClient.clear();
        local.destroy();
      }
    });
  }
});
