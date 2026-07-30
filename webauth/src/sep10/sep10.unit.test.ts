import { Buffer } from "buffer";
import {
  assertEquals,
  assertNotStrictEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { type KeypairSigner, LocalSigner } from "@colibri/core";
import {
  buildSep10Challenge,
  createWebAuthFixture,
  testJwt,
} from "colibri-internal/tests/helpers/webauth/fixtures.ts";
import type {
  Sep10Challenge,
  Sep10SignedChallenge,
} from "@/sep10/challenge.ts";
import { Sep10Client } from "@/sep10/client.ts";
import {
  hasSep10ClientDomainOperation,
  verifySep10Challenge,
} from "@/sep10/verify-challenge.ts";
import { Sep10Code, Sep10Error, WebAuthCode, WebAuthError } from "@/error.ts";

function expectCode(fn: () => unknown, code: string): void {
  assertEquals(assertThrows(fn, Sep10Error).code, code);
}

describe("SEP-10 WebAuth", () => {
  it("verifySep10Challenge accepts strict inclusive challenge boundaries", () => {
    const fixture = createWebAuthFixture();
    const now = Math.floor(Date.now() / 1_000);
    for (
      const boundary of [
        { minTime: now, maxTime: now + 10, check: now },
        { minTime: now - 10, maxTime: now, check: now },
      ]
    ) {
      const transactionXdr = buildSep10Challenge(fixture, boundary);
      const verified = verifySep10Challenge({
        transactionXdr,
        networkPassphrase: fixture.networkPassphrase,
        serverAccount: fixture.server.publicKey(),
        account: fixture.client.publicKey(),
        homeDomain: fixture.homeDomain,
        webAuthDomain: fixture.webAuthDomain,
        now: boundary.check,
      });
      assertEquals(verified.account, fixture.client.publicKey());
      assertEquals(verified.serverAccount, fixture.server.publicKey());
      assertEquals(verified.homeDomain, fixture.homeDomain);
      assertEquals(verified.webAuthDomain, fixture.webAuthDomain);
      assertEquals(verified.memo, undefined);
      assertEquals(verified.clientDomain, undefined);
    }
  });

  it("verifySep10Challenge binds memo and an accepted client domain", () => {
    const fixture = createWebAuthFixture();
    const transactionXdr = buildSep10Challenge(fixture, {
      memo: "42",
      clientDomain: "wallet.test",
    });
    assertEquals(
      hasSep10ClientDomainOperation(
        transactionXdr,
        fixture.networkPassphrase,
      ),
      true,
    );
    const verified = verifySep10Challenge({
      transactionXdr,
      networkPassphrase: fixture.networkPassphrase,
      serverAccount: fixture.server.publicKey(),
      account: fixture.client.publicKey(),
      memo: "42",
      homeDomain: fixture.homeDomain,
      webAuthDomain: fixture.webAuthDomain,
      clientDomain: "wallet.test",
      clientDomainAccount: fixture.clientDomain.publicKey(),
    });
    assertEquals(verified.memo, "42");
    assertEquals(verified.clientDomain, "wallet.test");
    assertEquals(
      verified.clientDomainAccount,
      fixture.clientDomain.publicKey(),
    );
    assertEquals(verified.transactionXdr, transactionXdr);
  });

  it("verifySep10Challenge maps XDR, sequence, source, and time failures", () => {
    const fixture = createWebAuthFixture();
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: "invalid",
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_XDR,
    );
    expectCode(
      () => hasSep10ClientDomainOperation("invalid", fixture.networkPassphrase),
      Sep10Code.INVALID_XDR,
    );

    const wrongSequence = buildSep10Challenge(fixture, { sequence: "0" });
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: wrongSequence,
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_SEQUENCE,
    );
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: buildSep10Challenge(fixture),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: Keypair.random().publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_SERVER_ACCOUNT,
    );

    const noBounds = xdr.TransactionEnvelope.fromXDR(
      buildSep10Challenge(fixture),
      "base64",
    );
    noBounds.v1().tx().cond(xdr.Preconditions.precondNone());
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: noBounds.toXDR("base64"),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.TIMEBOUNDS_MISSING,
    );

    for (
      const [options, code] of [
        [{ minTime: 1, maxTime: 0 }, Sep10Code.TIMEBOUNDS_INFINITE],
        [{ minTime: 200, maxTime: 300, now: 199 }, Sep10Code.NOT_YET_VALID],
        [{ minTime: 100, maxTime: 200, now: 201 }, Sep10Code.EXPIRED],
      ] as const
    ) {
      const xdr = buildSep10Challenge(fixture, {
        minTime: options.minTime,
        maxTime: options.maxTime,
      });
      expectCode(
        () =>
          verifySep10Challenge({
            transactionXdr: xdr,
            networkPassphrase: fixture.networkPassphrase,
            serverAccount: fixture.server.publicKey(),
            account: fixture.client.publicKey(),
            homeDomain: fixture.homeDomain,
            webAuthDomain: fixture.webAuthDomain,
            now: options.now ?? 1,
          }),
        code,
      );
    }
  });

  it("verifySep10Challenge rejects malformed first operations", () => {
    const fixture = createWebAuthFixture();
    const empty = xdr.TransactionEnvelope.fromXDR(
      buildSep10Challenge(fixture),
      "base64",
    );
    empty.v1().tx().operations([]);
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: empty.toXDR("base64"),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.NO_OPERATIONS,
    );

    const payment = new TransactionBuilder(
      new Account(fixture.server.publicKey(), "-1"),
      {
        fee: "100",
        networkPassphrase: fixture.networkPassphrase,
        timebounds: {
          minTime: Math.floor(Date.now() / 1_000) - 1,
          maxTime: Math.floor(Date.now() / 1_000) + 100,
        },
      },
    )
      .addOperation(
        Operation.payment({
          source: fixture.client.publicKey(),
          destination: fixture.server.publicKey(),
          asset: Asset.native(),
          amount: "1",
        }),
      )
      .build();
    payment.sign(fixture.server);
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: payment.toXDR(),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_OPERATION,
    );

    const missingSource = new TransactionBuilder(
      new Account(fixture.server.publicKey(), "-1"),
      {
        fee: "100",
        networkPassphrase: fixture.networkPassphrase,
        timebounds: {
          minTime: Math.floor(Date.now() / 1_000) - 1,
          maxTime: Math.floor(Date.now() / 1_000) + 100,
        },
      },
    )
      .addOperation(
        Operation.manageData({
          name: `${fixture.homeDomain} auth`,
          value: Buffer.alloc(48).toString("base64"),
        }),
      )
      .build();
    missingSource.sign(fixture.server);
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: missingSource.toXDR(),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_OPERATION,
    );

    for (
      const [options, code] of [
        [{ account: Keypair.random().publicKey() }, Sep10Code.ACCOUNT_MISMATCH],
        [{ homeDomain: "wrong.test" }, Sep10Code.INVALID_HOME_DOMAIN],
      ] as const
    ) {
      expectCode(
        () =>
          verifySep10Challenge({
            transactionXdr: buildSep10Challenge(fixture, options),
            networkPassphrase: fixture.networkPassphrase,
            serverAccount: fixture.server.publicKey(),
            account: fixture.client.publicKey(),
            homeDomain: fixture.homeDomain,
            webAuthDomain: fixture.webAuthDomain,
          }),
        code,
      );
    }

    const wrongName = xdr.TransactionEnvelope.fromXDR(
      buildSep10Challenge(fixture),
      "base64",
    );
    wrongName.v1().tx().operations()[0].body().manageDataOp().dataName(
      "wrong-name",
    );
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: wrongName.toXDR("base64"),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_HOME_DOMAIN,
    );

    const wrongNonce = new TransactionBuilder(
      new Account(fixture.server.publicKey(), "-1"),
      {
        fee: "100",
        networkPassphrase: fixture.networkPassphrase,
        timebounds: {
          minTime: Math.floor(Date.now() / 1_000) - 1,
          maxTime: Math.floor(Date.now() / 1_000) + 100,
        },
      },
    )
      .addOperation(
        Operation.manageData({
          source: fixture.client.publicKey(),
          name: `${fixture.homeDomain} auth`,
          value: "short",
        }),
      )
      .build();
    wrongNonce.sign(fixture.server);
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: wrongNonce.toXDR(),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_NONCE,
    );

    const missingNonce = xdr.TransactionEnvelope.fromXDR(
      buildSep10Challenge(fixture),
      "base64",
    );
    missingNonce.v1().tx().operations()[0].body().manageDataOp().dataValue(
      null,
    );
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: missingNonce.toXDR("base64"),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_NONCE,
    );
  });

  it("verifySep10Challenge rejects memo and later-operation mismatches", () => {
    const fixture = createWebAuthFixture();
    for (
      const [challengeMemo, expectedMemo] of [
        ["1", undefined],
        [undefined, "1"],
        ["1", "2"],
      ] as const
    ) {
      expectCode(
        () =>
          verifySep10Challenge({
            transactionXdr: buildSep10Challenge(fixture, {
              memo: challengeMemo,
            }),
            networkPassphrase: fixture.networkPassphrase,
            serverAccount: fixture.server.publicKey(),
            account: fixture.client.publicKey(),
            memo: expectedMemo,
            homeDomain: fixture.homeDomain,
            webAuthDomain: fixture.webAuthDomain,
          }),
        Sep10Code.MEMO_MISMATCH,
      );
    }

    const wrongSource = Keypair.random();
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: buildSep10Challenge(fixture, {
            laterOperation: Operation.manageData({
              source: wrongSource.publicKey(),
              name: "extension",
              value: "value",
            }),
          }),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_OPERATION,
    );
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: buildSep10Challenge(fixture, {
            laterOperation: Operation.payment({
              destination: fixture.client.publicKey(),
              asset: Asset.native(),
              amount: "1",
            }) as ReturnType<typeof Operation.manageData>,
          }),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_OPERATION,
    );
    const extensionWithoutSource = buildSep10Challenge(fixture, {
      laterOperation: Operation.manageData({
        name: "extension",
        value: null,
      }),
    });
    assertEquals(
      verifySep10Challenge({
        transactionXdr: extensionWithoutSource,
        networkPassphrase: fixture.networkPassphrase,
        serverAccount: fixture.server.publicKey(),
        account: fixture.client.publicKey(),
        homeDomain: fixture.homeDomain,
        webAuthDomain: fixture.webAuthDomain,
      }).account,
      fixture.client.publicKey(),
    );
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: buildSep10Challenge(fixture, {
            omitWebAuthDomain: true,
          }),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_WEB_AUTH_DOMAIN,
    );
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: buildSep10Challenge(fixture, {
            webAuthDomain: "wrong.test",
          }),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_WEB_AUTH_DOMAIN,
    );
  });

  it("verifySep10Challenge enforces client-domain and server signatures", () => {
    const fixture = createWebAuthFixture();
    const clientDomainXdr = buildSep10Challenge(fixture, {
      clientDomain: "wallet.test",
    });
    for (
      const input of [
        {},
        { clientDomain: "other.test" },
        {
          clientDomain: "wallet.test",
          clientDomainAccount: Keypair.random().publicKey(),
        },
      ]
    ) {
      const code = input.clientDomain === "other.test"
        ? Sep10Code.CLIENT_DOMAIN_VALUE_MISMATCH
        : input.clientDomain === "wallet.test"
        ? Sep10Code.CLIENT_DOMAIN_SIGNING_KEY
        : Sep10Code.CLIENT_DOMAIN_UNEXPECTED;
      expectCode(
        () =>
          verifySep10Challenge({
            transactionXdr: clientDomainXdr,
            networkPassphrase: fixture.networkPassphrase,
            serverAccount: fixture.server.publicKey(),
            account: fixture.client.publicKey(),
            homeDomain: fixture.homeDomain,
            webAuthDomain: fixture.webAuthDomain,
            ...input,
          }),
        code,
      );
    }
    expectCode(
      () =>
        verifySep10Challenge({
          transactionXdr: buildSep10Challenge(fixture, { signServer: false }),
          networkPassphrase: fixture.networkPassphrase,
          serverAccount: fixture.server.publicKey(),
          account: fixture.client.publicKey(),
          homeDomain: fixture.homeDomain,
          webAuthDomain: fixture.webAuthDomain,
        }),
      Sep10Code.INVALID_SERVER_SIGNATURE,
    );
  });

  function clientFor(
    fixture: ReturnType<typeof createWebAuthFixture>,
    fetch: typeof globalThis.fetch,
  ): Sep10Client {
    return new Sep10Client({
      endpoint: `https://${fixture.webAuthDomain}/auth`,
      serverAccount: fixture.server.publicKey(),
      homeDomain: fixture.homeDomain,
      webAuthDomain: fixture.webAuthDomain,
      networkPassphrase: fixture.networkPassphrase,
      fetch,
    });
  }

  it("Sep10Client completes an immutable account-only flow", async () => {
    const fixture = createWebAuthFixture();
    const challengeXdr = buildSep10Challenge(fixture);
    const now = Math.floor(Date.now() / 1_000);
    const token = testJwt({
      iss: "https://issuer.test",
      sub: fixture.client.publicKey(),
      iat: now,
      exp: now + 100,
    });
    const requests: Request[] = [];
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return request.method === "GET"
        ? await new Response(
          JSON.stringify({
            transaction: challengeXdr,
            network_passphrase: fixture.networkPassphrase,
          }),
        )
        : await new Response(JSON.stringify({ token }));
    };
    const client = clientFor(fixture, fetch);
    assertEquals(client.endpoint, `https://${fixture.webAuthDomain}/auth`);
    const challenge = await client.getChallenge({
      account: fixture.client.publicKey(),
    });
    assertEquals(challenge.account, fixture.client.publicKey());
    assertEquals(challenge.memo, undefined);
    assertEquals(challenge.clientDomain, undefined);
    assertEquals(challenge.clientDomainAccount, undefined);
    assertEquals(challenge.toXDR(), challengeXdr);
    assertEquals(challenge.transaction.signatures.length, 1);
    assertNotStrictEquals(challenge.transaction, challenge.transaction);
    assertNotStrictEquals(
      challenge.verified.transaction,
      challenge.verified.transaction,
    );
    assertEquals(challenge.timeBounds.minTime instanceof Date, true);

    const signer = LocalSigner.fromSecret(fixture.client.secret() as never);
    const signed = await client.signChallenge(challenge, signer);
    assertEquals(challenge.transaction.signatures.length, 1);
    assertEquals(signed.transaction.signatures.length, 2);
    assertNotStrictEquals(signed.transaction, signed.transaction);
    assertNotStrictEquals(
      signed.verified.transaction,
      signed.verified.transaction,
    );
    const result = await client.submitChallenge(signed);
    assertEquals(result.token, token);
    assertEquals(result.protocol, "sep10");
    assertEquals(
      new URL(requests[0].url).searchParams.get("home_domain"),
      fixture.homeDomain,
    );
    assertEquals(
      JSON.parse(await requests[1].text()).transaction,
      signed.toXDR(),
    );
    signer.destroy();
  });

  it("Sep10Client client-domain flow fetches TOML only when accepted", async () => {
    const fixture = createWebAuthFixture();
    const now = Math.floor(Date.now() / 1_000);
    for (const accepted of [false, true]) {
      let tomlFetches = 0;
      const challengeXdr = buildSep10Challenge(
        fixture,
        accepted ? { clientDomain: "wallet.test" } : {},
      );
      const fetch = async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const request = new Request(input, init);
        if (request.url.includes("/.well-known/stellar.toml")) {
          tomlFetches++;
          return await new Response(
            `SIGNING_KEY = "${fixture.clientDomain.publicKey()}"`,
          );
        }
        if (request.method === "GET") {
          return await new Response(
            JSON.stringify({ transaction: challengeXdr }),
          );
        }
        return await new Response(
          JSON.stringify({
            token: testJwt({
              iss: "https://issuer.test",
              sub: fixture.client.publicKey(),
              iat: now,
              exp: now + 100,
              ...(accepted ? { client_domain: "wallet.test" } : {}),
            }),
          }),
        );
      };
      const result = await clientFor(fixture, fetch).authenticate({
        account: fixture.client.publicKey(),
        signer: [fixture.client],
        clientDomain: "wallet.test",
        clientDomainSigner: fixture.clientDomain,
      });
      assertEquals(result.clientDomain, accepted ? "wallet.test" : undefined);
      assertEquals(tomlFetches, accepted ? 1 : 0);
    }
  });

  it("Sep10Client rejects request, discovery, signing, state, and token failures", async () => {
    const fixture = createWebAuthFixture();
    const validXdr = buildSep10Challenge(fixture);
    const responseClient = (body: Record<string, unknown>) =>
      clientFor(fixture, async () => await new Response(JSON.stringify(body)));

    let memoRequest: Request | undefined;
    await clientFor(fixture, async (input, init) => {
      memoRequest = new Request(input, init);
      return await new Response(
        JSON.stringify({
          transaction: buildSep10Challenge(fixture, { memo: "42" }),
        }),
      );
    }).getChallenge({ account: fixture.client.publicKey(), memo: "42" });
    assertEquals(new URL(memoRequest!.url).searchParams.get("memo"), "42");

    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient({ transaction: validXdr }).getChallenge({
              account: fixture.contractAccount,
            }),
          Sep10Error,
        )
      ).code,
      Sep10Code.ACCOUNT_MISMATCH,
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient({ transaction: validXdr }).getChallenge({
              account:
                "MAQAA5L65LSYH7CQ3VTJ7F3HHLGCL3DSLAR2Y47263D56MNNGHSQSAAAAAAAAAAE2LP26",
              memo: "1",
            }),
          WebAuthError,
        )
      ).code,
      WebAuthCode.OPTION_MISMATCH,
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient({ nope: true }).getChallenge({
              account: fixture.client.publicKey(),
            }),
          Sep10Error,
        )
      ).code,
      Sep10Code.CLIENT_REQUEST_FAILED,
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient({
              transaction: validXdr,
              network_passphrase: "wrong",
            }).getChallenge({ account: fixture.client.publicKey() }),
          WebAuthError,
        )
      ).code,
      WebAuthCode.NETWORK_MISMATCH,
    );

    const acceptedDomainXdr = buildSep10Challenge(fixture, {
      clientDomain: "wallet.test",
    });
    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient({ transaction: acceptedDomainXdr }).getChallenge({
              account: fixture.client.publicKey(),
            }),
          Sep10Error,
        )
      ).code,
      Sep10Code.CLIENT_DOMAIN_UNEXPECTED,
    );
    const discoveryFailure = clientFor(
      fixture,
      async (input) =>
        String(input).includes("/.well-known/")
          ? await new Response("bad toml =")
          : await new Response(
            JSON.stringify({ transaction: acceptedDomainXdr }),
          ),
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            discoveryFailure.getChallenge({
              account: fixture.client.publicKey(),
              clientDomain: "wallet.test",
            }),
          Sep10Error,
        )
      ).code,
      Sep10Code.CLIENT_DOMAIN_DISCOVERY,
    );
    const noSigningKey = clientFor(
      fixture,
      async (input) =>
        String(input).includes("/.well-known/")
          ? await new Response('VERSION = "2.0.0"')
          : await new Response(
            JSON.stringify({ transaction: acceptedDomainXdr }),
          ),
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            noSigningKey.getChallenge({
              account: fixture.client.publicKey(),
              clientDomain: "wallet.test",
            }),
          Sep10Error,
        )
      ).code,
      Sep10Code.CLIENT_DOMAIN_SIGNING_KEY,
    );

    const client = responseClient({ transaction: validXdr });
    const challenge = await client.getChallenge({
      account: fixture.client.publicKey(),
    });
    assertEquals(
      (
        await assertRejects(
          () => client.signChallenge({} as Sep10Challenge, fixture.client),
          Sep10Error,
        )
      ).code,
      Sep10Code.INVALID_STATE,
    );
    assertEquals(
      (
        await assertRejects(
          () => client.signChallenge(challenge, []),
          Sep10Error,
        )
      ).code,
      Sep10Code.SIGNING_FAILED,
    );
    assertEquals(
      (
        await assertRejects(
          () => client.submitChallenge({} as Sep10SignedChallenge),
          Sep10Error,
        )
      ).code,
      Sep10Code.INVALID_STATE,
    );

    const noTokenClient = clientFor(fixture, async (input, init) => {
      const request = new Request(input, init);
      return request.method === "GET"
        ? await new Response(JSON.stringify({ transaction: validXdr }))
        : await new Response("{}");
    });
    const signed = await noTokenClient.signChallenge(
      await noTokenClient.getChallenge({ account: fixture.client.publicKey() }),
      fixture.client,
    );
    assertEquals(
      (
        await assertRejects(
          () => noTokenClient.submitChallenge(signed),
          Sep10Error,
        )
      ).code,
      Sep10Code.CLIENT_REQUEST_FAILED,
    );
  });

  it("Sep10Client requires and validates an accepted client-domain signer", async () => {
    const fixture = createWebAuthFixture();
    const challengeXdr = buildSep10Challenge(fixture, {
      clientDomain: "wallet.test",
    });
    const fetch = async (input: string | URL | Request) =>
      String(input).includes("/.well-known/")
        ? await new Response(
          `SIGNING_KEY = "${fixture.clientDomain.publicKey()}"`,
        )
        : await new Response(JSON.stringify({ transaction: challengeXdr }));
    const client = clientFor(fixture, fetch);
    const challenge = await client.getChallenge({
      account: fixture.client.publicKey(),
      clientDomain: "wallet.test",
    });
    assertEquals(
      (
        await assertRejects(
          () => client.signChallenge(challenge, fixture.client),
          Sep10Error,
        )
      ).code,
      Sep10Code.CLIENT_DOMAIN_SIGNER_MISSING,
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            client.signChallenge(
              challenge,
              fixture.client,
              Keypair.random(),
            ),
          Sep10Error,
        )
      ).code,
      Sep10Code.CLIENT_DOMAIN_SIGNING_KEY,
    );

    const signer = LocalSigner.fromSecret(
      fixture.clientDomain.secret() as never,
    );
    const signed = await client.signChallenge(
      challenge,
      fixture.client,
      signer,
    );
    assertEquals(signed.transaction.signatures.length, 3);
    signer.destroy();

    const failingSigner = {
      publicKey: () => fixture.client.publicKey(),
      signerKey: () => fixture.client.publicKey(),
      sign: () => {
        throw new Error("signing failed");
      },
      signTransaction: () => "",
      signSorobanAuthEntry: () => Promise.reject(new Error("unused")),
      signsFor: () => true,
    } as unknown as KeypairSigner;
    assertEquals(
      (
        await assertRejects(
          () => client.signChallenge(challenge, failingSigner),
          Sep10Error,
        )
      ).code,
      Sep10Code.SIGNING_FAILED,
    );
  });
});
