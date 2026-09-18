import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { stub } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import { LocalSigner, NetworkConfig } from "@colibri/core";
import { ContractAuth, WebAuthClient, WebAuthToken } from "@colibri/webauth";
import { createColibriConfig } from "@/context/config.ts";
import { createWebAuthSession } from "@/webauth/session/session.ts";
import { ColibriReactError } from "@/errors/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const signer = LocalSigner.generateRandom();
const account = signer.publicKey();
const network = NetworkConfig.TestNet();
const setup = () => {
  const config = createColibriConfig({ network });
  const client = new WebAuthClient({
    homeDomain: "example.org",
    signingKey: account,
    network,
    sep10: { endpoint: "https://example.org/auth" },
  });
  return { config, client, session: createWebAuthSession(config, client) };
};
const token = (expires = Date.now() + 100000) =>
  WebAuthToken.authenticated(
    `e30.${
      btoa(
        JSON.stringify({
          iss: "https://example.org/auth",
          sub: account,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(expires / 1000),
        }),
      )
    }.signature`,
    {
      protocol: "sep10",
      account,
      homeDomain: "example.org",
      webAuthDomain: "example.org",
    },
  );
describe("memory-only WebAuth sessions", () => {
  it("shares tokens and expires without browser storage", async () => {
    using time = new FakeTime(2000000000000);
    const { config, client, session } = setup();
    const authenticated = token(Date.now() + 10000);
    using exchange = stub(
      client,
      "authenticate",
      () => Promise.resolve(authenticated),
    );
    let changes = 0;
    const unsubscribe = session.subscribe(() => {
      changes++;
    });
    await session.authenticate({ account, signer });
    assertEquals(session.getSnapshot().token, authenticated);
    assertEquals(session.getServerSnapshot().status, "anonymous");
    time.tick(10001);
    assertEquals(session.getSnapshot().status, "anonymous");
    assertEquals(exchange.calls.length, 1);
    assertEquals(changes, 4);
    unsubscribe();
    session.destroy();
    config.destroy();
  });
  it("passes SEP-45 authorization options unchanged", async () => {
    const { config, client, session } = setup();
    const options = { account, authorize: ContractAuth.none() };
    const authenticated = token();
    using exchange = stub(
      client,
      "authenticate",
      () => Promise.resolve(authenticated),
    );
    try {
      await session.authenticate(options);
      assertEquals(exchange.calls[0].args, [options]);
    } finally {
      session.destroy();
      config.destroy();
    }
  });
  it("logout and connection changes invalidate outstanding authentication", async () => {
    const { config, client, session } = setup();
    let finish!: (value: WebAuthToken) => void;
    using _exchange = stub(
      client,
      "authenticate",
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = session.authenticate({ account, signer });
    session.logout();
    finish(token());
    await assertRejects(() => pending, ColibriReactError);
    assertEquals(session.getSnapshot().token, undefined);
    const next = session.authenticate({ account, signer });
    await config.disconnect();
    finish(token());
    await assertRejects(() => next, ColibriReactError);
    session.destroy();
    config.destroy();
  });
  it("retains exchange errors and never accepts decoded-only credentials", async () => {
    const { config, client, session } = setup();
    using _exchange = stub(
      client,
      "authenticate",
      () => Promise.resolve(WebAuthToken.decode(token().token)),
    );
    await assertRejects(
      () => session.authenticate({ account, signer }),
      ColibriReactError,
    );
    assertEquals(session.getSnapshot().status, "anonymous");
    session.destroy();
    await assertRejects(
      () => session.authenticate({ account, signer }),
      ColibriReactError,
    );
    config.destroy();
  });
  it("rejects mismatched networks and active accounts", async () => {
    const { config, client, session } = setup();
    const other = createColibriConfig({ network: NetworkConfig.MainNet() });
    assertThrows(() => createWebAuthSession(other, client), ColibriReactError);
    other.destroy();
    session.destroy();
    config.destroy();
    const connected = createColibriConfig({
      network,
      connectors: [{
        id: "different",
        connect: () =>
          Promise.resolve({
            address: "G-other",
            networkPassphrase: network.networkPassphrase,
            signers: [],
          }),
      }],
    });
    await connected.connect("different");
    const bound = createWebAuthSession(connected, client);
    await assertRejects(
      () => bound.authenticate({ account, signer }),
      ColibriReactError,
    );
    bound.destroy();
    connected.destroy();
  });
});
