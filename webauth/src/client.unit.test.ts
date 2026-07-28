import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { NetworkConfig, StellarToml } from "@colibri/core";
import {
  buildSep10Challenge,
  createWebAuthFixture,
  testJwt,
} from "colibri-internal/tests/helpers/webauth/fixtures.ts";
import { WebAuthClient } from "@/client.ts";
import { ContractAuth } from "@/sep45/contract-auth.ts";
import { WebAuthCode, WebAuthError } from "@/error.ts";

function expectCode(fn: () => unknown, code: string): void {
  assertEquals(assertThrows(fn, WebAuthError).code, code);
}

Deno.test("WebAuthClient exposes complete direct protocol configuration", () => {
  const fixture = createWebAuthFixture();
  const network = NetworkConfig.TestNet();
  const client = new WebAuthClient({
    homeDomain: `${fixture.homeDomain}/`,
    signingKey: fixture.server.publicKey(),
    network,
    sep10: { endpoint: `https://${fixture.webAuthDomain}/sep10` },
    sep45: {
      endpoint: `https://${fixture.webAuthDomain}/sep45`,
      contractId: fixture.webAuthContractId,
    },
  });
  assertEquals(client.homeDomain, fixture.homeDomain);
  assertStrictEquals(client.network, network);
  assertEquals(client.supports("sep10"), true);
  assertEquals(client.supports("sep45"), true);
  assertEquals(client.sep10.endpoint, `https://${fixture.webAuthDomain}/sep10`);
  assertEquals(client.sep45.endpoint, `https://${fixture.webAuthDomain}/sep45`);
  assertEquals(client.protocolFor(fixture.client.publicKey()), "sep10");
  assertEquals(client.protocolFor(fixture.contractAccount), "sep45");
});

Deno.test("WebAuthClient validates direct configuration without network calls", () => {
  const fixture = createWebAuthFixture();
  const network = NetworkConfig.TestNet();
  for (
    const config of [
      {
        homeDomain: "",
        signingKey: fixture.server.publicKey(),
        network,
        sep10: { endpoint: "https://auth.test" },
      },
      {
        homeDomain: fixture.homeDomain,
        signingKey: "invalid",
        network,
        sep10: { endpoint: "https://auth.test" },
      },
      {
        homeDomain: fixture.homeDomain,
        signingKey: fixture.server.publicKey(),
        network,
      },
    ]
  ) {
    expectCode(
      () => new WebAuthClient(config),
      WebAuthCode.INCOMPLETE_CONFIGURATION,
    );
  }
  for (const endpoint of ["not-a-url", "ftp://auth.test", "http://auth.test"]) {
    expectCode(
      () =>
        new WebAuthClient({
          homeDomain: fixture.homeDomain,
          signingKey: fixture.server.publicKey(),
          network,
          sep10: { endpoint },
        }),
      WebAuthCode.INCOMPLETE_CONFIGURATION,
    );
  }

  const local = new WebAuthClient({
    homeDomain: fixture.homeDomain,
    signingKey: fixture.server.publicKey(),
    network: NetworkConfig.CustomNet({
      networkPassphrase: fixture.networkPassphrase,
      rpcUrl: "http://localhost:8000",
      allowHttp: true,
    }),
    sep10: { endpoint: "http://localhost:3000/auth" },
  });
  assertEquals(local.sep10.endpoint, "http://localhost:3000/auth");

  expectCode(
    () =>
      new WebAuthClient({
        homeDomain: fixture.homeDomain,
        signingKey: fixture.server.publicKey(),
        network,
        sep45: {
          endpoint: "https://auth.test",
          contractId: "C-invalid",
        },
      }),
    WebAuthCode.INCOMPLETE_CONFIGURATION,
  );
  expectCode(
    () =>
      new WebAuthClient({
        homeDomain: fixture.homeDomain,
        signingKey: fixture.server.publicKey(),
        network: NetworkConfig.CustomNet({
          networkPassphrase: fixture.networkPassphrase,
        }),
        sep45: {
          endpoint: "https://auth.test",
          contractId: fixture.webAuthContractId,
        },
      }),
    WebAuthCode.MISSING_RPC,
  );
});

Deno.test("WebAuthClient constructs from complete TOML and enforces network", () => {
  const fixture = createWebAuthFixture();
  const toml = StellarToml.fromString(
    `
      SIGNING_KEY = "${fixture.server.publicKey()}"
      NETWORK_PASSPHRASE = "${fixture.networkPassphrase}"
      WEB_AUTH_ENDPOINT = "https://${fixture.webAuthDomain}/sep10"
      WEB_AUTH_FOR_CONTRACTS_ENDPOINT = "https://${fixture.webAuthDomain}/sep45"
      WEB_AUTH_CONTRACT_ID = "${fixture.webAuthContractId}"
    `,
    {},
    fixture.homeDomain,
  );
  const client = WebAuthClient.fromToml(toml, {
    network: NetworkConfig.TestNet(),
  });
  assertEquals(client.supports("sep10"), true);
  assertEquals(client.supports("sep45"), true);

  expectCode(
    () =>
      WebAuthClient.fromToml(toml, {
        network: NetworkConfig.MainNet(),
      }),
    WebAuthCode.NETWORK_MISMATCH,
  );
  const withoutDomain = StellarToml.fromString(
    `SIGNING_KEY = "${fixture.server.publicKey()}"
     WEB_AUTH_ENDPOINT = "https://${fixture.webAuthDomain}/sep10"`,
  );
  expectCode(
    () =>
      WebAuthClient.fromToml(withoutDomain, {
        network: NetworkConfig.TestNet(),
      }),
    WebAuthCode.INCOMPLETE_CONFIGURATION,
  );
});

Deno.test("WebAuthClient discovers TOML through the configured fetch boundary", async () => {
  const fixture = createWebAuthFixture();
  const requests: Request[] = [];
  const client = await WebAuthClient.fromDomain(fixture.homeDomain, {
    network: NetworkConfig.TestNet(),
    fetch: async (input, init) => {
      requests.push(new Request(input, init));
      return await new Response(
        `SIGNING_KEY = "${fixture.server.publicKey()}"
         WEB_AUTH_ENDPOINT = "https://${fixture.webAuthDomain}/auth"`,
      );
    },
  });
  assertEquals(
    requests[0].url,
    `https://${fixture.homeDomain}/.well-known/stellar.toml`,
  );
  assertEquals(client.supports("sep10"), true);
  assertEquals(client.supports("sep45"), false);
  assertEquals(
    assertThrows(() => client.sep45, WebAuthError).code,
    WebAuthCode.PROTOCOL_NOT_ADVERTISED,
  );

  const localRequests: Request[] = [];
  await WebAuthClient.fromDomain("localhost:3000", {
    network: NetworkConfig.CustomNet({
      networkPassphrase: fixture.networkPassphrase,
      rpcUrl: "http://localhost:8000",
      allowHttp: true,
    }),
    fetch: async (input, init) => {
      localRequests.push(new Request(input, init));
      return await new Response(
        `SIGNING_KEY = "${fixture.server.publicKey()}"
         WEB_AUTH_ENDPOINT = "http://localhost:3000/auth"`,
      );
    },
  });
  assertEquals(
    localRequests[0].url,
    "http://localhost:3000/.well-known/stellar.toml",
  );

  const networkWithoutAllowHttp = {
    type: "custom",
    networkPassphrase: fixture.networkPassphrase,
    rpcUrl: "https://rpc.test",
    isTestNet: () => false,
    isFutureNet: () => false,
    isMainNet: () => false,
    isCustomNet: () => true,
  } as unknown as ReturnType<typeof NetworkConfig.TestNet>;
  const defaultHttpPolicyRequests: Request[] = [];
  await WebAuthClient.fromDomain(fixture.homeDomain, {
    network: networkWithoutAllowHttp,
    fetch: async (input, init) => {
      defaultHttpPolicyRequests.push(new Request(input, init));
      return await new Response(
        `SIGNING_KEY = "${fixture.server.publicKey()}"
         WEB_AUTH_ENDPOINT = "https://${fixture.webAuthDomain}/auth"`,
      );
    },
  });
  assertEquals(
    defaultHttpPolicyRequests[0].url,
    `https://${fixture.homeDomain}/.well-known/stellar.toml`,
  );
});

Deno.test("WebAuthClient automatic SEP-10 path has no protocol fallback", async () => {
  const fixture = createWebAuthFixture();
  const challenge = buildSep10Challenge(fixture);
  const now = Math.floor(Date.now() / 1_000);
  const token = testJwt({
    iss: "https://issuer.test",
    sub: fixture.client.publicKey(),
    iat: now,
    exp: now + 100,
  });
  const urls: string[] = [];
  const client = new WebAuthClient({
    homeDomain: fixture.homeDomain,
    signingKey: fixture.server.publicKey(),
    network: NetworkConfig.TestNet(),
    sep10: { endpoint: `https://${fixture.webAuthDomain}/sep10` },
    sep45: {
      endpoint: `https://${fixture.webAuthDomain}/sep45`,
      contractId: fixture.webAuthContractId,
    },
    fetch: async (input, init) => {
      const request = new Request(input, init);
      urls.push(request.url);
      return request.method === "GET"
        ? await new Response(JSON.stringify({ transaction: challenge }))
        : await new Response(JSON.stringify({ token }));
    },
  });
  const result = await client.authenticate({
    account: fixture.client.publicKey(),
    signer: fixture.client,
  });
  assertEquals(result.protocol, "sep10");
  assertEquals(urls.every((url) => url.includes("/sep10")), true);

  const failingUrls: string[] = [];
  const failing = new WebAuthClient({
    homeDomain: fixture.homeDomain,
    signingKey: fixture.server.publicKey(),
    network: NetworkConfig.TestNet(),
    sep10: { endpoint: `https://${fixture.webAuthDomain}/sep10` },
    sep45: {
      endpoint: `https://${fixture.webAuthDomain}/sep45`,
      contractId: fixture.webAuthContractId,
    },
    fetch: async (input) => {
      failingUrls.push(String(input));
      return await new Response("denied", { status: 400 });
    },
  });
  await assertRejects(
    () =>
      failing.authenticate({
        account: fixture.client.publicKey(),
        signer: fixture.client,
      }),
    WebAuthError,
  );
  assertEquals(failingUrls.length, 1);
  assertEquals(failingUrls[0].includes("/sep10"), true);
});

Deno.test("WebAuthClient rejects protocol-incompatible automatic options", async () => {
  const fixture = createWebAuthFixture();
  const sep10Only = new WebAuthClient({
    homeDomain: fixture.homeDomain,
    signingKey: fixture.server.publicKey(),
    network: NetworkConfig.TestNet(),
    sep10: { endpoint: "https://auth.test/sep10" },
  });
  const sep45Only = new WebAuthClient({
    homeDomain: fixture.homeDomain,
    signingKey: fixture.server.publicKey(),
    network: NetworkConfig.TestNet(),
    sep45: {
      endpoint: "https://auth.test/sep45",
      contractId: fixture.webAuthContractId,
    },
  });

  for (
    const options of [
      { account: fixture.client.publicKey(), authorize: ContractAuth.none() },
      { account: fixture.client.publicKey() },
      {
        account: fixture.contractAccount,
        signer: fixture.client,
        authorize: ContractAuth.none(),
      },
      {
        account: fixture.contractAccount,
        memo: "1",
        authorize: ContractAuth.none(),
      },
      { account: fixture.contractAccount },
    ]
  ) {
    assertEquals(
      (
        await assertRejects(
          () => sep10Only.authenticate(options as never),
          WebAuthError,
        )
      ).code,
      WebAuthCode.OPTION_MISMATCH,
    );
  }

  assertEquals(
    (
      await assertRejects(
        () =>
          sep45Only.authenticate({
            account: fixture.client.publicKey(),
            signer: fixture.client,
          }),
        WebAuthError,
      )
    ).code,
    WebAuthCode.PROTOCOL_NOT_ADVERTISED,
  );
  assertEquals(
    assertThrows(() => sep45Only.sep10, WebAuthError).code,
    WebAuthCode.PROTOCOL_NOT_ADVERTISED,
  );
});
