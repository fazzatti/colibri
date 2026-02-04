/**
 * SEP-10 Client Unit Tests
 */

import { assertEquals, assertThrows, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Account,
} from "stellar-sdk";
import { Buffer } from "buffer";
import { StellarToml } from "@colibri/core";
import { Sep10Client } from "@/client/client.ts";
import { Sep10Jwt } from "@/client/jwt.ts";
import { SEP10Challenge } from "@/challenge/challenge.ts";
import * as E from "@/client/error.ts";

// =============================================================================
// Test Fixtures
// =============================================================================

const SERVER_KEYPAIR = Keypair.random();
const SERVER_PUBLIC_KEY = SERVER_KEYPAIR.publicKey();
const CLIENT_KEYPAIR = Keypair.random();
const CLIENT_PUBLIC_KEY = CLIENT_KEYPAIR.publicKey();

const HOME_DOMAIN = "example.com";
const WEB_AUTH_DOMAIN = "auth.example.com";
const AUTH_ENDPOINT = `https://${WEB_AUTH_DOMAIN}/auth`;
const NETWORK_PASSPHRASE = Networks.TESTNET;

/**
 * Creates a valid SEP-10 challenge transaction for testing
 */
function createValidChallengeXdr(options: { account?: string } = {}): string {
  const { account = CLIENT_PUBLIC_KEY } = options;

  const now = Math.floor(Date.now() / 1000);
  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(48))
  ).toString("base64");

  const serverAccount = new Account(SERVER_PUBLIC_KEY, "-1");
  const transaction = new TransactionBuilder(serverAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
    timebounds: { minTime: now, maxTime: now + 900 },
  })
    .addOperation(
      Operation.manageData({
        source: account,
        name: `${HOME_DOMAIN} auth`,
        value: nonce,
      })
    )
    .addOperation(
      Operation.manageData({
        source: SERVER_PUBLIC_KEY,
        name: "web_auth_domain",
        value: WEB_AUTH_DOMAIN,
      })
    )
    .build();

  transaction.sign(SERVER_KEYPAIR);

  return transaction.toXDR();
}

/**
 * Creates a test JWT token
 */
function createTestJwt(claims: Record<string, unknown> = {}): string {
  const header = { alg: "EdDSA", typ: "JWT" };
  const payload = {
    sub: CLIENT_PUBLIC_KEY,
    iss: AUTH_ENDPOINT,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...claims,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return `${encode(header)}.${encode(payload)}.fakesignature`;
}

/**
 * Creates a mock fetch function
 */
function createMockFetch(
  response: { status?: number; body?: unknown; error?: Error } = {}
): typeof fetch {
  const { status = 200, body = {}, error } = response;

  return (_url: string | URL | Request, _init?: RequestInit) => {
    if (error) {
      return Promise.reject(error);
    }

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        statusText: status === 200 ? "OK" : "Error",
        headers: { "Content-Type": "application/json" },
      })
    );
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("Sep10Client", () => {
  describe("constructor", () => {
    it("creates a client with required config", () => {
      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      assertEquals(client.authEndpoint, AUTH_ENDPOINT);
      assertEquals(client.serverPublicKey, SERVER_PUBLIC_KEY);
      assertEquals(client.homeDomain, HOME_DOMAIN);
      assertEquals(client.networkPassphrase, NETWORK_PASSPHRASE);
    });
  });

  describe("fromToml", () => {
    it("creates client from StellarToml instance", () => {
      const toml = StellarToml.fromString(
        `
WEB_AUTH_ENDPOINT = "${AUTH_ENDPOINT}"
SIGNING_KEY = "${SERVER_PUBLIC_KEY}"
NETWORK_PASSPHRASE = "${NETWORK_PASSPHRASE}"
`,
        { validate: false },
        HOME_DOMAIN
      );

      const client = Sep10Client.fromToml(toml);

      assertEquals(client.authEndpoint, AUTH_ENDPOINT);
      assertEquals(client.serverPublicKey, SERVER_PUBLIC_KEY);
      assertEquals(client.homeDomain, HOME_DOMAIN);
      assertEquals(client.networkPassphrase, NETWORK_PASSPHRASE);
    });

    it("throws MISSING_AUTH_ENDPOINT when WEB_AUTH_ENDPOINT is missing", () => {
      const toml = StellarToml.fromString(
        `
SIGNING_KEY = "${SERVER_PUBLIC_KEY}"
NETWORK_PASSPHRASE = "${NETWORK_PASSPHRASE}"
`,
        { validate: false },
        HOME_DOMAIN
      );

      const error = assertThrows(
        () => Sep10Client.fromToml(toml),
        E.MISSING_AUTH_ENDPOINT
      );
      assertEquals(error.code, E.Code.MISSING_AUTH_ENDPOINT);
    });

    it("throws INVALID_TOML when SIGNING_KEY is missing", () => {
      const toml = StellarToml.fromString(
        `
WEB_AUTH_ENDPOINT = "${AUTH_ENDPOINT}"
NETWORK_PASSPHRASE = "${NETWORK_PASSPHRASE}"
`,
        { validate: false },
        HOME_DOMAIN
      );

      const error = assertThrows(
        () => Sep10Client.fromToml(toml),
        E.INVALID_TOML
      );
      assertEquals(error.code, E.Code.INVALID_TOML);
    });

    it("throws INVALID_TOML when NETWORK_PASSPHRASE is missing and not provided", () => {
      const toml = StellarToml.fromString(
        `
WEB_AUTH_ENDPOINT = "${AUTH_ENDPOINT}"
SIGNING_KEY = "${SERVER_PUBLIC_KEY}"
`,
        { validate: false },
        HOME_DOMAIN
      );

      const error = assertThrows(
        () => Sep10Client.fromToml(toml),
        E.INVALID_TOML
      );
      assertEquals(error.code, E.Code.INVALID_TOML);
    });

    it("uses provided networkPassphrase over toml value", () => {
      const toml = StellarToml.fromString(
        `
WEB_AUTH_ENDPOINT = "${AUTH_ENDPOINT}"
SIGNING_KEY = "${SERVER_PUBLIC_KEY}"
NETWORK_PASSPHRASE = "wrong passphrase"
`,
        { validate: false },
        HOME_DOMAIN
      );

      const client = Sep10Client.fromToml(toml, NETWORK_PASSPHRASE);
      assertEquals(client.networkPassphrase, NETWORK_PASSPHRASE);
    });

    it("extracts web auth domain from endpoint URL", () => {
      const toml = StellarToml.fromString(
        `
WEB_AUTH_ENDPOINT = "https://custom-auth.example.org/auth"
SIGNING_KEY = "${SERVER_PUBLIC_KEY}"
NETWORK_PASSPHRASE = "${NETWORK_PASSPHRASE}"
`,
        { validate: false },
        HOME_DOMAIN
      );

      const client = Sep10Client.fromToml(toml);
      assertEquals(client.authEndpoint, "https://custom-auth.example.org/auth");
    });

    it("throws INVALID_TOML when WEB_AUTH_ENDPOINT is not a valid URL", () => {
      const toml = StellarToml.fromString(
        `
WEB_AUTH_ENDPOINT = "not-a-valid-url"
SIGNING_KEY = "${SERVER_PUBLIC_KEY}"
NETWORK_PASSPHRASE = "${NETWORK_PASSPHRASE}"
`,
        { validate: false },
        HOME_DOMAIN
      );

      const error = assertThrows(
        () => Sep10Client.fromToml(toml),
        E.INVALID_TOML
      );
      assertEquals(error.code, E.Code.INVALID_TOML);
    });

    it("throws INVALID_TOML when domain is missing", () => {
      const toml = StellarToml.fromString(
        `
WEB_AUTH_ENDPOINT = "${AUTH_ENDPOINT}"
SIGNING_KEY = "${SERVER_PUBLIC_KEY}"
NETWORK_PASSPHRASE = "${NETWORK_PASSPHRASE}"
`,
        { validate: false }
        // No domain provided
      );

      const error = assertThrows(
        () => Sep10Client.fromToml(toml),
        E.INVALID_TOML
      );
      assertEquals(error.code, E.Code.INVALID_TOML);
    });
  });

  describe("getChallenge", () => {
    it("fetches and returns a verified challenge", async () => {
      const challengeXdr = createValidChallengeXdr();
      const mockFetch = createMockFetch({
        body: {
          transaction: challengeXdr,
          network_passphrase: NETWORK_PASSPHRASE,
        },
      });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        webAuthDomain: WEB_AUTH_DOMAIN,
        fetch: mockFetch,
      });

      const challenge = await client.getChallenge({
        account: CLIENT_PUBLIC_KEY,
      });

      assertEquals(challenge.clientAccount, CLIENT_PUBLIC_KEY);
      assertEquals(challenge.serverAccount, SERVER_PUBLIC_KEY);
      assertEquals(challenge.homeDomain, HOME_DOMAIN);
    });

    it("includes memo in request when provided", async () => {
      let capturedUrl = "";
      const mockFetch = (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return Promise.resolve(
          new Response(
            JSON.stringify({ transaction: createValidChallengeXdr() }),
            { status: 200 }
          )
        );
      };

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        webAuthDomain: WEB_AUTH_DOMAIN,
        fetch: mockFetch,
      });

      await client.getChallenge({ account: CLIENT_PUBLIC_KEY, memo: "12345" });

      assertEquals(capturedUrl.includes("memo=12345"), true);
    });

    it("includes client_domain in request when provided", async () => {
      let capturedUrl = "";
      const mockFetch = (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return Promise.resolve(
          new Response(
            JSON.stringify({ transaction: createValidChallengeXdr() }),
            { status: 200 }
          )
        );
      };

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        webAuthDomain: WEB_AUTH_DOMAIN,
        fetch: mockFetch,
      });

      await client.getChallenge({
        account: CLIENT_PUBLIC_KEY,
        clientDomain: "wallet.example.com",
      });

      assertEquals(
        capturedUrl.includes("client_domain=wallet.example.com"),
        true
      );
    });

    it("throws FETCH_CHALLENGE_FAILED on network error", async () => {
      const mockFetch = createMockFetch({
        error: new Error("Network error"),
      });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      await assertRejects(
        () => client.getChallenge({ account: CLIENT_PUBLIC_KEY }),
        E.FETCH_CHALLENGE_FAILED
      );
    });

    it("throws FETCH_CHALLENGE_FAILED on non-OK response", async () => {
      const mockFetch = createMockFetch({ status: 500 });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      await assertRejects(
        () => client.getChallenge({ account: CLIENT_PUBLIC_KEY }),
        E.FETCH_CHALLENGE_FAILED
      );
    });

    it("throws INVALID_SERVER_RESPONSE on invalid JSON", async () => {
      const mockFetch = () =>
        Promise.resolve(
          new Response("not json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      await assertRejects(
        () => client.getChallenge({ account: CLIENT_PUBLIC_KEY }),
        E.INVALID_SERVER_RESPONSE
      );
    });

    it("throws INVALID_SERVER_RESPONSE when transaction field is missing", async () => {
      const mockFetch = createMockFetch({ body: { other: "data" } });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      await assertRejects(
        () => client.getChallenge({ account: CLIENT_PUBLIC_KEY }),
        E.INVALID_SERVER_RESPONSE
      );
    });

    it("throws TIMEOUT on request timeout", async () => {
      const mockFetch = (_url: string | URL | Request, init?: RequestInit) => {
        // Simulate abort
        if (init?.signal) {
          return new Promise<Response>((_, reject) => {
            init.signal!.addEventListener("abort", () => {
              const error = new Error("Aborted");
              error.name = "AbortError";
              reject(error);
            });
            // Trigger abort immediately for testing
            setTimeout(() => {
              if (init.signal!.aborted) {
                const error = new Error("Aborted");
                error.name = "AbortError";
                reject(error);
              }
            }, 0);
          });
        }
        return Promise.resolve(new Response());
      };

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
        timeout: 1, // 1ms timeout
      });

      await assertRejects(
        () => client.getChallenge({ account: CLIENT_PUBLIC_KEY }),
        E.TIMEOUT
      );
    });

    it("uses client timeTolerance when verifying challenge", async () => {
      // Create a challenge that would expire 4 seconds ago, but should pass with default 5s tolerance
      const now = Math.floor(Date.now() / 1000);
      const nonce = Buffer.from(
        crypto.getRandomValues(new Uint8Array(48))
      ).toString("base64");

      const serverAccount = new Account(SERVER_PUBLIC_KEY, "-1");
      const transaction = new TransactionBuilder(serverAccount, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now - 904, maxTime: now - 4 }, // Expired 4s ago
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: nonce,
          })
        )
        .addOperation(
          Operation.manageData({
            source: SERVER_PUBLIC_KEY,
            name: "web_auth_domain",
            value: WEB_AUTH_DOMAIN,
          })
        )
        .build();

      transaction.sign(SERVER_KEYPAIR);
      const xdr = transaction.toXDR();

      const mockFetch = createMockFetch({
        body: { transaction: xdr, network_passphrase: NETWORK_PASSPHRASE },
      });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
        timeTolerance: 10, // 10s tolerance should accept 4s expired
      });

      const challenge = await client.getChallenge({
        account: CLIENT_PUBLIC_KEY,
      });
      assertEquals(challenge.clientAccount, CLIENT_PUBLIC_KEY);
    });

    it("allows per-request timeTolerance override", async () => {
      // Create a challenge that expires 4 seconds ago
      const now = Math.floor(Date.now() / 1000);
      const nonce = Buffer.from(
        crypto.getRandomValues(new Uint8Array(48))
      ).toString("base64");

      const serverAccount = new Account(SERVER_PUBLIC_KEY, "-1");
      const transaction = new TransactionBuilder(serverAccount, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now - 904, maxTime: now - 4 }, // Expired 4s ago
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: nonce,
          })
        )
        .addOperation(
          Operation.manageData({
            source: SERVER_PUBLIC_KEY,
            name: "web_auth_domain",
            value: WEB_AUTH_DOMAIN,
          })
        )
        .build();

      transaction.sign(SERVER_KEYPAIR);
      const xdr = transaction.toXDR();

      const mockFetch = createMockFetch({
        body: { transaction: xdr, network_passphrase: NETWORK_PASSPHRASE },
      });

      // Client has strict 2s tolerance
      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
        timeTolerance: 2, // Would normally reject 4s expired
      });

      // But per-request override of 10s accepts it
      const challenge = await client.getChallenge({
        account: CLIENT_PUBLIC_KEY,
        timeTolerance: 10, // Override to allow 4s expired
      });
      assertEquals(challenge.clientAccount, CLIENT_PUBLIC_KEY);
    });

    it("allows per-request skipTimeValidation override", async () => {
      // Create a very expired challenge
      const now = Math.floor(Date.now() / 1000);
      const nonce = Buffer.from(
        crypto.getRandomValues(new Uint8Array(48))
      ).toString("base64");

      const serverAccount = new Account(SERVER_PUBLIC_KEY, "-1");
      const transaction = new TransactionBuilder(serverAccount, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now - 1000, maxTime: now - 100 }, // Very expired
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: nonce,
          })
        )
        .addOperation(
          Operation.manageData({
            source: SERVER_PUBLIC_KEY,
            name: "web_auth_domain",
            value: WEB_AUTH_DOMAIN,
          })
        )
        .build();

      transaction.sign(SERVER_KEYPAIR);
      const xdr = transaction.toXDR();

      const mockFetch = createMockFetch({
        body: { transaction: xdr, network_passphrase: NETWORK_PASSPHRASE },
      });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      // Skip time validation entirely for this request
      const challenge = await client.getChallenge({
        account: CLIENT_PUBLIC_KEY,
        skipTimeValidation: true,
      });
      assertEquals(challenge.clientAccount, CLIENT_PUBLIC_KEY);
    });
  });

  describe("submitChallenge", () => {
    it("submits signed challenge and returns JWT", async () => {
      const jwtToken = createTestJwt();
      const mockFetch = createMockFetch({ body: { token: jwtToken } });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      // Create and sign a challenge
      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      challenge.sign(CLIENT_KEYPAIR);

      const jwt = await client.submitChallenge(challenge);

      assertEquals(jwt instanceof Sep10Jwt, true);
      assertEquals(jwt.subject, CLIENT_PUBLIC_KEY);
    });

    it("throws SUBMIT_CHALLENGE_FAILED on network error", async () => {
      const mockFetch = createMockFetch({ error: new Error("Network error") });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      await assertRejects(
        () => client.submitChallenge(challenge),
        E.SUBMIT_CHALLENGE_FAILED
      );
    });

    it("throws SUBMIT_CHALLENGE_FAILED on non-OK response with error body", async () => {
      const mockFetch = createMockFetch({
        status: 400,
        body: { error: "Invalid signature" },
      });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      await assertRejects(
        () => client.submitChallenge(challenge),
        E.SUBMIT_CHALLENGE_FAILED
      );
    });

    it("throws MISSING_JWT when token is missing from response", async () => {
      const mockFetch = createMockFetch({ body: { other: "data" } });

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      await assertRejects(
        () => client.submitChallenge(challenge),
        E.MISSING_JWT
      );
    });

    it("handles non-JSON error response gracefully", async () => {
      const mockFetch = () =>
        Promise.resolve(
          new Response("Server error", {
            status: 500,
            statusText: "Internal Server Error",
          })
        );

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
      });

      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      await assertRejects(
        () => client.submitChallenge(challenge),
        E.SUBMIT_CHALLENGE_FAILED
      );
    });

    it("throws TIMEOUT on request timeout", async () => {
      const mockFetch = (_url: string | URL | Request, init?: RequestInit) => {
        if (init?.signal) {
          return new Promise<Response>((_, reject) => {
            init.signal!.addEventListener("abort", () => {
              const error = new Error("Aborted");
              error.name = "AbortError";
              reject(error);
            });
            setTimeout(() => {
              if (init.signal!.aborted) {
                const error = new Error("Aborted");
                error.name = "AbortError";
                reject(error);
              }
            }, 0);
          });
        }
        return Promise.resolve(new Response());
      };

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        fetch: mockFetch,
        timeout: 1,
      });

      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      await assertRejects(() => client.submitChallenge(challenge), E.TIMEOUT);
    });
  });

  describe("authenticate", () => {
    it("completes full authentication flow with single signer", async () => {
      const challengeXdr = createValidChallengeXdr();
      const jwtToken = createTestJwt();

      let requestCount = 0;
      const mockFetch = (_url: string | URL | Request, init?: RequestInit) => {
        requestCount++;
        if (init?.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ transaction: challengeXdr }), {
              status: 200,
            })
          );
        } else {
          return Promise.resolve(
            new Response(JSON.stringify({ token: jwtToken }), {
              status: 200,
            })
          );
        }
      };

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        webAuthDomain: WEB_AUTH_DOMAIN,
        fetch: mockFetch,
      });

      const jwt = await client.authenticate({
        account: CLIENT_PUBLIC_KEY,
        signer: CLIENT_KEYPAIR,
      });

      assertEquals(requestCount, 2); // GET challenge + POST signed
      assertEquals(jwt instanceof Sep10Jwt, true);
      assertEquals(jwt.subject, CLIENT_PUBLIC_KEY);
    });

    it("supports array of signers", async () => {
      const challengeXdr = createValidChallengeXdr();
      const jwtToken = createTestJwt();

      const mockFetch = (_url: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ transaction: challengeXdr }), {
              status: 200,
            })
          );
        } else {
          return Promise.resolve(
            new Response(JSON.stringify({ token: jwtToken }), {
              status: 200,
            })
          );
        }
      };

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        webAuthDomain: WEB_AUTH_DOMAIN,
        fetch: mockFetch,
      });

      const signer2 = Keypair.random();
      const jwt = await client.authenticate({
        account: CLIENT_PUBLIC_KEY,
        signer: [CLIENT_KEYPAIR, signer2],
      });

      assertEquals(jwt instanceof Sep10Jwt, true);
    });

    it("supports extra signers", async () => {
      const challengeXdr = createValidChallengeXdr();
      const jwtToken = createTestJwt();

      const mockFetch = (_url: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ transaction: challengeXdr }), {
              status: 200,
            })
          );
        } else {
          return Promise.resolve(
            new Response(JSON.stringify({ token: jwtToken }), {
              status: 200,
            })
          );
        }
      };

      const client = new Sep10Client({
        authEndpoint: AUTH_ENDPOINT,
        serverPublicKey: SERVER_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        webAuthDomain: WEB_AUTH_DOMAIN,
        fetch: mockFetch,
      });

      const extraSigner = Keypair.random();
      const jwt = await client.authenticate({
        account: CLIENT_PUBLIC_KEY,
        signer: CLIENT_KEYPAIR,
        extraSigners: [extraSigner],
        clientDomain: "wallet.example.com",
      });

      assertEquals(jwt instanceof Sep10Jwt, true);
    });
  });
});

// =============================================================================
// Error Classes Coverage Tests
// =============================================================================

describe("Error Classes Coverage", () => {
  describe("FETCH_CHALLENGE_FAILED", () => {
    it("uses status code when provided", () => {
      const error = new E.FETCH_CHALLENGE_FAILED(
        "https://example.com/auth",
        undefined,
        404,
        "Not Found"
      );
      assertEquals(error.details?.includes("failed with status 404"), true);
    });

    it("uses status code with empty statusText", () => {
      const error = new E.FETCH_CHALLENGE_FAILED(
        "https://example.com/auth",
        undefined,
        404,
        "" // empty statusText
      );
      assertEquals(error.details?.includes("failed with status 404"), true);
    });

    it("uses default message when no status code", () => {
      const error = new E.FETCH_CHALLENGE_FAILED(
        "https://example.com/auth",
        new Error("Network error")
      );
      assertEquals(error.details?.includes("Failed to fetch challenge"), true);
    });
  });

  describe("SUBMIT_CHALLENGE_FAILED", () => {
    it("uses status code when provided", () => {
      const error = new E.SUBMIT_CHALLENGE_FAILED(
        "https://example.com/auth",
        undefined,
        400,
        "Bad Request",
        "Invalid signature"
      );
      assertEquals(error.details?.includes("failed with status 400"), true);
    });

    it("uses status code with empty statusText", () => {
      const error = new E.SUBMIT_CHALLENGE_FAILED(
        "https://example.com/auth",
        undefined,
        400,
        "" // empty statusText
      );
      assertEquals(error.details?.includes("failed with status 400"), true);
    });

    it("uses default message when no status code", () => {
      const error = new E.SUBMIT_CHALLENGE_FAILED(
        "https://example.com/auth",
        new Error("Network error")
      );
      assertEquals(
        error.details?.includes("Failed to submit signed challenge"),
        true
      );
    });
  });

  describe("INVALID_JWT", () => {
    it("uses reason when provided", () => {
      const error = new E.INVALID_JWT("token", "Custom reason");
      assertEquals(error.details, "Custom reason");
      assertEquals(error.diagnostic?.rootCause, "Custom reason");
    });

    it("uses default message when no reason", () => {
      const error = new E.INVALID_JWT("token");
      assertEquals(
        error.details,
        "The JWT token returned by the server is invalid."
      );
      assertEquals(error.diagnostic?.rootCause, "JWT validation failed");
    });
  });

  describe("INVALID_TOML", () => {
    it("shows field when provided", () => {
      const error = new E.INVALID_TOML("example.com", "SIGNING_KEY");
      assertEquals(
        error.details?.includes("has an invalid 'SIGNING_KEY' field"),
        true
      );
    });

    it("shows generic message when no field", () => {
      const error = new E.INVALID_TOML("example.com");
      assertEquals(
        error.details?.includes("is invalid or incomplete for SEP-10"),
        true
      );
    });
  });
});
