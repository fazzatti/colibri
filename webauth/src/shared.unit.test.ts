import { Buffer } from "buffer";
import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertNotEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Keypair, StrKey } from "stellar-sdk";
import {
  Sep10Code,
  Sep10Error,
  Sep45Code,
  Sep45Error,
  WebAuthCode,
  WebAuthError,
} from "@/error.ts";
import { protocolForAccount } from "@/routing.ts";
import { WebAuthToken } from "@/token.ts";
import { WebAuthTransport } from "@/transport.ts";
import { testJwt } from "colibri-internal/tests/helpers/webauth/fixtures.ts";

const MUXED_ACCOUNT =
  "MAQAA5L65LSYH7CQ3VTJ7F3HHLGCL3DSLAR2Y47263D56MNNGHSQSAAAAAAAAAAE2LP26";

describe("WebAuth shared behavior", () => {
  it("routing fully validates supported addresses", () => {
    assertEquals(protocolForAccount(Keypair.random().publicKey()), "sep10");
    assertEquals(protocolForAccount(MUXED_ACCOUNT), "sep10");
    const contract = StrKey.encodeContract(
      Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
    );
    assertEquals(protocolForAccount(contract), "sep45");

    for (const invalid of ["G-not-valid", "M-not-valid", "C-not-valid"]) {
      const error = assertThrows(
        () => protocolForAccount(invalid),
        WebAuthError,
      );
      assertEquals(error.code, WebAuthCode.INVALID_ACCOUNT);
    }
    const unsupported = assertThrows(
      () => protocolForAccount("SSECRET"),
      WebAuthError,
    );
    assertEquals(unsupported.code, WebAuthCode.UNSUPPORTED_ACCOUNT);
    assertEquals(
      assertThrows(() => protocolForAccount(""), WebAuthError).code,
      WebAuthCode.UNSUPPORTED_ACCOUNT,
    );
  });

  it("error hierarchy carries protocol-safe metadata", () => {
    const shared = new WebAuthError({
      code: WebAuthCode.TRANSPORT,
      message: "shared",
      endpoint: "https://example.test",
      cause: new Error("cause"),
      diagnostic: { rootCause: "test", suggestion: "retry" },
    });
    assertEquals(shared.protocol, undefined);
    assertEquals(shared.meta?.endpoint, "https://example.test");
    assertEquals(shared.name, `WebAuthError ${WebAuthCode.TRANSPORT}`);
    assertEquals(shared.toJSON().code, WebAuthCode.TRANSPORT);

    const sep10 = new Sep10Error({
      code: Sep10Code.INVALID_XDR,
      message: "sep10",
    });
    assertInstanceOf(sep10, WebAuthError);
    assertEquals(sep10.protocol, "sep10");
    assertEquals(sep10.name, `Sep10Error ${Sep10Code.INVALID_XDR}`);

    const sep45 = new Sep45Error({
      code: Sep45Code.INVALID_XDR,
      message: "sep45",
    });
    assertInstanceOf(sep45, WebAuthError);
    assertEquals(sep45.protocol, "sep45");
    assertEquals(sep45.name, `Sep45Error ${Sep45Code.INVALID_XDR}`);
  });

  it("WebAuthToken decode mode exposes claims without auth context", () => {
    const tokenText = testJwt({
      sub: "subject-ç",
      iss: "https://issuer.test",
      iat: 100,
      exp: 200,
      jti: "id",
      client_domain: "wallet.test",
      custom: { enabled: true },
    });
    const token = WebAuthToken.decode(tokenText);
    assertEquals(token.token, tokenText);
    assertEquals(token.toString(), tokenText);
    assertEquals(token.protocol, undefined);
    assertEquals(token.account, undefined);
    assertEquals(token.subject, "subject-ç");
    assertEquals(token.issuer, "https://issuer.test");
    assertEquals(token.issuedAt, new Date(100_000));
    assertEquals(token.expiresAt, new Date(200_000));
    assertEquals(token.jti, "id");
    assertEquals(token.clientDomain, "wallet.test");
    assertEquals(token.homeDomain, undefined);
    assertEquals(token.webAuthDomain, undefined);
    const claims = token.claims as Record<string, unknown>;
    claims.sub = "changed";
    assertEquals(token.subject, "subject-ç");

    const minimal = WebAuthToken.decode(testJwt({}));
    assertEquals(minimal.subject, undefined);
    assertEquals(minimal.issuer, undefined);
    assertEquals(minimal.issuedAt, undefined);
    assertEquals(minimal.expiresAt, undefined);
    assertEquals(minimal.jti, undefined);
    assertEquals(minimal.clientDomain, undefined);
  });

  it("WebAuthToken validates authenticated SEP context", () => {
    const context = {
      protocol: "sep10" as const,
      account: Keypair.random().publicKey(),
      memo: "42",
      homeDomain: "example.test",
      webAuthDomain: "auth.example.test",
      clientDomain: "wallet.test",
      now: 100,
    };
    const text = testJwt({
      iss: "https://issuer.test",
      sub: `${context.account}:42`,
      iat: 90,
      exp: 101,
      client_domain: "wallet.test",
      custom: true,
    });
    const token = WebAuthToken.authenticated(text, context);
    assertEquals(token.protocol, "sep10");
    assertEquals(token.account, context.account);
    assertEquals(token.homeDomain, context.homeDomain);
    assertEquals(token.webAuthDomain, context.webAuthDomain);
    assertEquals(token.claims.custom, true);

    const sep45Account = StrKey.encodeContract(Buffer.alloc(32, 9));
    const sep45 = WebAuthToken.authenticated(
      testJwt({
        iss: "urn:colibri:test",
        sub: sep45Account,
        iat: 90,
        exp: Math.floor(Date.now() / 1_000) + 100,
      }),
      {
        protocol: "sep45",
        account: sep45Account,
        homeDomain: "example.test",
        webAuthDomain: "auth.example.test",
      },
    );
    assertEquals(sep45.protocol, "sep45");
    assertEquals(sep45.clientDomain, undefined);
  });

  it("WebAuthToken rejects malformed tokens and context mismatches", () => {
    for (const value of ["one.two", "one..three", "one.%%%25.three"]) {
      assertEquals(
        assertThrows(() => WebAuthToken.decode(value), WebAuthError).code,
        WebAuthCode.INVALID_TOKEN,
      );
    }
    const nonObject = `${btoa("{}")}.${btoa("[]")}.x`;
    const nonObjectError = assertThrows(
      () => WebAuthToken.decode(nonObject),
      WebAuthError,
    );
    assertEquals(
      nonObjectError.code,
      WebAuthCode.INVALID_TOKEN,
    );
    assertEquals(
      nonObjectError.details,
      "The token payload must be a JSON object.",
    );

    const base = {
      iss: "https://issuer.test",
      sub: "GACCOUNT",
      iat: 90,
      exp: 110,
    };
    const context = {
      protocol: "sep10" as const,
      account: "GACCOUNT",
      homeDomain: "example.test",
      webAuthDomain: "auth.example.test",
      now: 100,
    };
    for (
      const [claims, code] of [
        [{ ...base, iss: undefined }, WebAuthCode.INVALID_TOKEN],
        [{ ...base, iss: "::not-uri" }, WebAuthCode.INVALID_TOKEN],
        [{ ...base, sub: undefined }, WebAuthCode.INVALID_TOKEN],
        [{ ...base, iat: "90" }, WebAuthCode.INVALID_TOKEN],
        [{ ...base, exp: Number.NaN }, WebAuthCode.INVALID_TOKEN],
        [{ ...base, exp: 100 }, WebAuthCode.TOKEN_EXPIRED],
        [{ ...base, sub: "GOTHER" }, WebAuthCode.TOKEN_CONTEXT_MISMATCH],
        [
          { ...base, client_domain: "unexpected.test" },
          WebAuthCode.TOKEN_CONTEXT_MISMATCH,
        ],
      ] as const
    ) {
      assertEquals(
        assertThrows(
          () => WebAuthToken.authenticated(testJwt(claims), context),
          WebAuthError,
        ).code,
        code,
      );
    }
    assertEquals(
      assertThrows(
        () =>
          WebAuthToken.authenticated(testJwt(base), {
            ...context,
            clientDomain: "wallet.test",
          }),
        WebAuthError,
      ).code,
      WebAuthCode.TOKEN_CONTEXT_MISMATCH,
    );
  });

  it("WebAuthTransport sends exact GET and JSON/form POST requests", async () => {
    const requests: Request[] = [];
    const transport = new WebAuthTransport({
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return await new Response('{"ok":true}', { status: 200 });
      },
    });
    const get = await transport.get(
      "https://auth.test/path?retained=yes",
      new URLSearchParams({ account: "G", home_domain: "example.test" }),
      "sep10",
    );
    assertEquals(get.body.ok, true);
    assertEquals(
      new URL(requests[0].url).searchParams.get("retained"),
      "yes",
    );
    assertEquals(requests[0].headers.get("accept"), "application/json");

    await transport.post(
      "https://auth.test",
      "transaction",
      "xdr",
      "json",
      "sep10",
    );
    assertEquals(requests[1].headers.get("content-type"), "application/json");
    assertEquals(await requests[1].text(), '{"transaction":"xdr"}');

    await transport.post(
      "https://auth.test",
      "authorization_entries",
      "a+b",
      "form",
      "sep45",
    );
    assertEquals(
      requests[2].headers.get("content-type"),
      "application/x-www-form-urlencoded",
    );
    assertEquals(await requests[2].text(), "authorization_entries=a%2Bb");
  });

  it("WebAuthTransport maps status, parsing, shape, network, and timeout failures", async () => {
    const rejected = new WebAuthTransport({
      fetch: async () =>
        await new Response("x".repeat(3_000), {
          status: 429,
          statusText: "Limited",
        }),
    });
    const status = await assertRejects(
      () =>
        rejected.get(
          "https://auth.test",
          new URLSearchParams(),
          "sep45",
        ),
      WebAuthError,
    );
    assertEquals(status.code, WebAuthCode.TRANSPORT);
    assertEquals(status.meta?.data?.status, 429);
    assertEquals((status.meta?.data?.body as string).length, 2_048);

    const emptyRejection = new WebAuthTransport({
      fetch: async () =>
        await new Response("", {
          status: 503,
          statusText: "Unavailable",
        }),
    });
    const emptyStatus = await assertRejects(
      () =>
        emptyRejection.get(
          "https://auth.test",
          new URLSearchParams(),
          "sep10",
        ),
      WebAuthError,
    );
    assertEquals(emptyStatus.details, "Unavailable");

    for (
      const response of [
        new Response("not-json"),
        new Response("[]"),
      ]
    ) {
      const transport = new WebAuthTransport({
        fetch: () => Promise.resolve(response.clone()),
      });
      const error = await assertRejects(
        () =>
          transport.get(
            "https://auth.test",
            new URLSearchParams(),
            "sep10",
          ),
        WebAuthError,
      );
      assertEquals(error.code, WebAuthCode.INVALID_RESPONSE);
    }

    const network = new WebAuthTransport({
      fetch: () => {
        throw new Error("offline");
      },
    });
    assertEquals(
      (
        await assertRejects(
          () =>
            network.get(
              "https://auth.test",
              new URLSearchParams(),
              "sep10",
            ),
          WebAuthError,
        )
      ).code,
      WebAuthCode.TRANSPORT,
    );

    const timeout = new WebAuthTransport({
      timeout: 1,
      fetch: (input, init) =>
        new Promise((_resolve, reject) => {
          new Request(input, init).signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")));
        }),
    });
    const timeoutError = await assertRejects(
      () =>
        timeout.get(
          "https://auth.test",
          new URLSearchParams(),
          "sep45",
        ),
      WebAuthError,
    );
    assertEquals(timeoutError.code, WebAuthCode.TIMEOUT);
    assertEquals(timeoutError.meta?.data?.timeout, 1);
    assert(timeoutError.meta?.cause instanceof DOMException);
    assertNotEquals(timeoutError.meta?.cause, undefined);
  });
});
