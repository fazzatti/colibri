import { Buffer } from "buffer";
import {
  assertEquals,
  assertNotStrictEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { AuthEntrySigner, KeypairSigner } from "@colibri/core";
import {
  Address,
  Keypair,
  SorobanDataBuilder,
  type Transaction,
  xdr,
} from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import {
  buildSep45Challenge,
  createWebAuthFixture,
  sep45Entry,
  testJwt,
} from "colibri-internal/tests/helpers/webauth/fixtures.ts";
import {
  Sep45AuthorizedChallenge,
  Sep45Challenge,
  Sep45PreparedChallenge,
} from "@/sep45/challenge.ts";
import { Sep45Client } from "@/sep45/client.ts";
import {
  cloneSep45AuthorizationEntry,
  decodeSep45AuthorizationEntries,
} from "@/sep45/codec.ts";
import {
  ContractAuth,
  type ContractAuthHandler,
} from "@/sep45/contract-auth.ts";
import {
  simulateSep45Challenge,
  validateSep45Footprint,
} from "@/sep45/simulation.ts";
import type { Sep45Rpc } from "@/sep45/types.ts";
import { verifySep45Challenge } from "@/sep45/verify-challenge.ts";
import { Sep45Code, Sep45Error, WebAuthCode, WebAuthError } from "@/error.ts";

type Fixture = ReturnType<typeof createWebAuthFixture>;

function contractDataKey(
  address: string,
  key: xdr.ScVal,
): xdr.LedgerKey {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(address).toScAddress(),
      key,
      durability: xdr.ContractDataDurability.temporary(),
    }),
  );
}

function nonceKey(address: string): xdr.LedgerKey {
  return contractDataKey(
    address,
    xdr.ScVal.scvLedgerKeyNonce(
      new xdr.ScNonceKey({ nonce: xdr.Int64.fromString("42") }),
    ),
  );
}

function instanceKey(address: string): xdr.LedgerKey {
  return contractDataKey(address, xdr.ScVal.scvLedgerKeyContractInstance());
}

function simulationSuccess(
  readOnly: xdr.LedgerKey[] = [],
  readWrite: xdr.LedgerKey[] = [],
): Api.SimulateTransactionSuccessResponse {
  return {
    id: "simulation",
    latestLedger: 101,
    events: [],
    _parsed: true,
    transactionData: new SorobanDataBuilder()
      .setFootprint(readOnly, readWrite),
    minResourceFee: "100",
  };
}

function rpcFixture(options: {
  sequence?: number;
  response?: Api.SimulateTransactionResponse;
  latestError?: unknown;
  simulationError?: unknown;
} = {}): Sep45Rpc & {
  transaction?: Transaction;
  authMode?: string;
} {
  const rpc = {
    transaction: undefined as Transaction | undefined,
    authMode: undefined as string | undefined,
    async getLatestLedger() {
      if (options.latestError !== undefined) {
        throw options.latestError;
      }
      return await { sequence: options.sequence ?? 100 };
    },
    async simulateTransaction(
      transaction: Transaction,
      _leeway?: unknown,
      authMode?: "enforce" | "record" | "record_allow_nonroot",
    ) {
      rpc.transaction = transaction;
      rpc.authMode = authMode;
      if (options.simulationError !== undefined) {
        throw options.simulationError;
      }
      return await (
        options.response ?? simulationSuccess()
      );
    },
  };
  return rpc as Sep45Rpc & {
    transaction?: Transaction;
    authMode?: string;
  };
}

async function challengeState(
  fixture: Fixture,
  options: {
    clientDomain?: boolean;
    expiration?: number;
    extraEntries?: xdr.SorobanAuthorizationEntry[];
  } = {},
): Promise<Sep45Challenge> {
  const challenge = await buildSep45Challenge(fixture, options);
  return new Sep45Challenge(
    verifySep45Challenge({
      authorizationEntriesXdr: challenge.xdr,
      networkPassphrase: fixture.networkPassphrase,
      webAuthContractId: fixture.webAuthContractId,
      serverAccount: fixture.server.publicKey(),
      account: fixture.contractAccount,
      homeDomain: fixture.homeDomain,
      webAuthDomain: fixture.webAuthDomain,
      clientDomain: options.clientDomain ? "wallet.test" : undefined,
      clientDomainAccount: options.clientDomain
        ? fixture.clientDomain.publicKey()
        : undefined,
      latestLedger: 100,
    }),
  );
}

function clientFor(
  fixture: Fixture,
  rpc: Sep45Rpc,
  fetch: typeof globalThis.fetch,
): Sep45Client {
  return new Sep45Client({
    endpoint: `https://${fixture.webAuthDomain}/auth`,
    serverAccount: fixture.server.publicKey(),
    homeDomain: fixture.homeDomain,
    webAuthDomain: fixture.webAuthDomain,
    webAuthContractId: fixture.webAuthContractId,
    networkPassphrase: fixture.networkPassphrase,
    rpc,
    fetch,
  });
}

function expectCode(fn: () => unknown, code: string): void {
  assertEquals(assertThrows(fn, Sep45Error).code, code);
}

describe("SEP-45 lifecycle", () => {
  it("SEP-45 challenge states expose defensive XDR clones", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await challengeState(fixture);
    assertEquals(challenge.account, fixture.contractAccount);
    assertEquals(challenge.clientDomain, undefined);
    assertEquals(challenge.arguments.account, fixture.contractAccount);
    assertEquals(challenge.extensionArguments, {});
    assertNotStrictEquals(challenge.entries[0], challenge.entries[0]);
    assertNotStrictEquals(
      challenge.verified.entries,
      challenge.verified.entries,
    );

    const authorized = new Sep45AuthorizedChallenge(
      challenge.verified,
      challenge.entries,
      106,
    );
    assertEquals(authorized.validUntilLedgerSeq, 106);
    assertNotStrictEquals(authorized.entries[0], authorized.entries[0]);
    assertNotStrictEquals(
      authorized.verified.entries,
      authorized.verified.entries,
    );

    const receipt = {
      latestLedger: 101,
      transactionXdr: "xdr",
      readOnlyFootprint: ["one"],
      readWriteFootprint: ["two"],
    };
    const prepared = new Sep45PreparedChallenge(authorized, receipt);
    const firstReceipt = prepared.simulation;
    (firstReceipt.readOnlyFootprint as string[])[0] = "changed";
    assertEquals(prepared.simulation.readOnlyFootprint[0], "one");
    assertEquals(prepared.authorized, authorized);
    assertEquals(prepared.toXDR(), authorized.toXDR());
  });

  it("ContractAuth adapters preserve the full-entry callback boundary", async () => {
    const fixture = createWebAuthFixture();
    const entry = sep45Entry(fixture, fixture.server.publicKey());
    const context = {
      networkPassphrase: fixture.networkPassphrase,
      validUntilLedgerSeq: 106,
    };

    const none = await ContractAuth.none()(entry, context);
    assertNotStrictEquals(none, entry);
    assertEquals(none.toXDR(), entry.toXDR());

    const ed25519 = await ContractAuth.ed25519(fixture.server)(entry, context);
    assertEquals(
      ed25519.credentials().address().signatureExpirationLedger(),
      106,
    );

    let called = false;
    const signer = {
      publicKey: () => fixture.server.publicKey(),
      signerKey: () => fixture.server.publicKey(),
      sign: (value: Uint8Array) => value,
      signTransaction: () => "",
      signsFor: () => true,
      async signSorobanAuthEntry(
        value: xdr.SorobanAuthorizationEntry,
        expiration: number,
        passphrase: string,
      ) {
        called = expiration === 106 && passphrase === fixture.networkPassphrase;
        return await cloneSep45AuthorizationEntry(value);
      },
    } as unknown as AuthEntrySigner;
    const adapted = await ContractAuth.fromSigner(signer)(entry, context);
    assertEquals(called, true);
    assertEquals(adapted.toXDR(), entry.toXDR());
  });

  it("Sep45Client authorizes the whole returned entry without comparison", async () => {
    const fixture = createWebAuthFixture();
    const client = clientFor(
      fixture,
      rpcFixture({ sequence: 100 }),
      async () => await new Response("{}"),
    );
    const challenge = await challengeState(fixture, {
      extraEntries: [
        sep45Entry(
          fixture,
          Address.contract(Buffer.alloc(32, 7)).toString(),
        ),
      ],
    });
    let receivedExpiration = 0;
    const authorized = await client.authorizeChallenge(
      challenge,
      (entry, context) => {
        receivedExpiration = context.validUntilLedgerSeq;
        const changed = cloneSep45AuthorizationEntry(entry);
        changed.credentials().address().nonce(xdr.Int64.fromString("999"));
        return changed;
      },
    );
    assertEquals(receivedExpiration, 106);
    assertEquals(authorized.validUntilLedgerSeq, 106);
    assertEquals(
      authorized.entries[0].credentials().address().nonce().toString(),
      "999",
    );
    assertEquals(authorized.entries.length, 3);
    assertEquals(
      challenge.entries[0].credentials().address().nonce().toString(),
      "42",
    );
  });

  it("Sep45Client validates authorization state, handler, validity, and expiry", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await challengeState(fixture);
    const client = clientFor(
      fixture,
      rpcFixture({ sequence: 100 }),
      async () => await new Response("{}"),
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            client.authorizeChallenge(
              {} as Sep45Challenge,
              ContractAuth.none(),
            ),
          Sep45Error,
        )
      ).code,
      Sep45Code.INVALID_STATE,
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            client.authorizeChallenge(
              challenge,
              undefined as unknown as ContractAuthHandler,
            ),
          Sep45Error,
        )
      ).code,
      Sep45Code.AUTH_HANDLER_MISSING,
    );
    for (const validity of [0, -1, 1.5, Number.NaN]) {
      assertEquals(
        (
          await assertRejects(
            () =>
              client.authorizeChallenge(challenge, ContractAuth.none(), {
                authorizationValidityLedgers: validity,
              }),
            Sep45Error,
          )
        ).code,
        Sep45Code.INVALID_VALIDITY,
      );
    }

    const capped = await clientFor(
      fixture,
      rpcFixture({ sequence: 198 }),
      async () => await new Response("{}"),
    ).authorizeChallenge(challenge, ContractAuth.none(), {
      authorizationValidityLedgers: 50,
    });
    assertEquals(capped.validUntilLedgerSeq, 200);

    for (
      const [rpc, code] of [
        [
          rpcFixture({ latestError: new Error("offline") }),
          Sep45Code.RPC_FAILED,
        ],
        [rpcFixture({ sequence: 200 }), Sep45Code.SERVER_ENTRY_EXPIRED],
      ] as const
    ) {
      assertEquals(
        (
          await assertRejects(
            () =>
              clientFor(
                fixture,
                rpc,
                async () => await new Response("{}"),
              ).authorizeChallenge(challenge, ContractAuth.none()),
            Sep45Error,
          )
        ).code,
        code,
      );
    }

    for (
      const [handler, code] of [
        [
          () => {
            throw new TypeError("application failure");
          },
          Sep45Code.AUTH_HANDLER_FAILED,
        ],
        [
          () =>
            ({
              toXDR() {
                throw new TypeError("invalid return");
              },
            }) as unknown as xdr.SorobanAuthorizationEntry,
          Sep45Code.INVALID_AUTHORIZED_ENTRY,
        ],
      ] as const
    ) {
      assertEquals(
        (
          await assertRejects(
            () => client.authorizeChallenge(challenge, handler),
            Sep45Error,
          )
        ).code,
        code,
      );
    }
  });

  it("Sep45Client signs accepted client-domain entries", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await challengeState(fixture, { clientDomain: true });
    const client = clientFor(
      fixture,
      rpcFixture(),
      async () => await new Response("{}"),
    );
    assertEquals(
      (
        await assertRejects(
          () => client.authorizeChallenge(challenge, ContractAuth.none()),
          Sep45Error,
        )
      ).code,
      Sep45Code.CLIENT_DOMAIN_SIGNER_MISSING,
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            client.authorizeChallenge(challenge, ContractAuth.none(), {
              clientDomainSigner: Keypair.random(),
            }),
          Sep45Error,
        )
      ).code,
      Sep45Code.CLIENT_DOMAIN_SIGNING_KEY,
    );

    const authorized = await client.authorizeChallenge(
      challenge,
      ContractAuth.none(),
      { clientDomainSigner: fixture.clientDomain },
    );
    assertEquals(
      authorized.entries[2].credentials().address()
        .signatureExpirationLedger(),
      106,
    );

    const signer = {
      publicKey: () => fixture.clientDomain.publicKey(),
      signerKey: () => fixture.clientDomain.publicKey(),
      sign: (value: Uint8Array) => value,
      signTransaction: () => "",
      signsFor: () => true,
      async signSorobanAuthEntry(
        value: xdr.SorobanAuthorizationEntry,
        expiration: number,
      ) {
        const clone = cloneSep45AuthorizationEntry(value);
        clone.credentials().address().signatureExpirationLedger(expiration);
        return await clone;
      },
    } as unknown as KeypairSigner;
    const withColibriSigner = await client.authorizeChallenge(
      challenge,
      ContractAuth.none(),
      { clientDomainSigner: signer },
    );
    assertEquals(withColibriSigner.validUntilLedgerSeq, 106);

    const failingSigner = {
      ...signer,
      signSorobanAuthEntry() {
        throw new Error("signing failed");
      },
    } as unknown as KeypairSigner;
    assertEquals(
      (
        await assertRejects(
          () =>
            client.authorizeChallenge(challenge, ContractAuth.none(), {
              clientDomainSigner: failingSigner,
            }),
          Sep45Error,
        )
      ).code,
      Sep45Code.AUTH_HANDLER_FAILED,
    );
  });

  it("validateSep45Footprint accepts only SEP-defined writes", () => {
    const fixture = createWebAuthFixture();
    const allowed = new Set([
      fixture.contractAccount,
      fixture.server.publicKey(),
      fixture.clientDomain.publicKey(),
    ]);
    validateSep45Footprint(
      [
        nonceKey(fixture.contractAccount),
        nonceKey(fixture.server.publicKey()),
        nonceKey(fixture.clientDomain.publicKey()),
        instanceKey(fixture.webAuthContractId),
      ],
      allowed,
      fixture.webAuthContractId,
    );

    const accountKey = xdr.LedgerKey.account(
      new xdr.LedgerKeyAccount({
        accountId: fixture.server.xdrAccountId(),
      }),
    );
    expectCode(
      () =>
        validateSep45Footprint(
          [accountKey],
          allowed,
          fixture.webAuthContractId,
        ),
      Sep45Code.UNSAFE_FOOTPRINT,
    );
    expectCode(
      () =>
        validateSep45Footprint(
          [nonceKey(Address.contract(Buffer.alloc(32, 5)).toString())],
          allowed,
          fixture.webAuthContractId,
        ),
      Sep45Code.UNSAFE_FOOTPRINT,
    );
    expectCode(
      () =>
        validateSep45Footprint(
          [instanceKey(fixture.contractAccount)],
          allowed,
          fixture.webAuthContractId,
        ),
      Sep45Code.INVALID_RESTORATION,
    );
    expectCode(
      () =>
        validateSep45Footprint(
          [
            contractDataKey(
              fixture.contractAccount,
              xdr.ScVal.scvSymbol("state"),
            ),
          ],
          allowed,
          fixture.webAuthContractId,
        ),
      Sep45Code.UNSAFE_FOOTPRINT,
    );
  });

  it("simulateSep45Challenge enforces mode, expiry, footprint, and restoration", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await challengeState(fixture);
    const authorized = new Sep45AuthorizedChallenge(
      challenge.verified,
      challenge.entries,
      106,
    );
    const rpc = rpcFixture({
      response: simulationSuccess(
        [instanceKey(fixture.webAuthContractId)],
        [nonceKey(fixture.contractAccount)],
      ),
    });
    const receipt = await simulateSep45Challenge(authorized, {
      rpc,
      networkPassphrase: fixture.networkPassphrase,
      webAuthContractId: fixture.webAuthContractId,
    });
    assertEquals(rpc.authMode, "enforce");
    assertEquals(receipt.latestLedger, 101);
    assertEquals(receipt.readOnlyFootprint.length, 1);
    assertEquals(receipt.readWriteFootprint.length, 1);
    assertEquals(typeof receipt.transactionXdr, "string");
    assertEquals(rpc.transaction?.operations.length, 1);

    const restoration = {
      ...simulationSuccess([], [nonceKey(fixture.server.publicKey())]),
      result: { auth: [], retval: xdr.ScVal.scvVoid() },
      restorePreamble: {
        minResourceFee: "100",
        transactionData: new SorobanDataBuilder().setReadWrite([
          instanceKey(fixture.webAuthContractId),
        ]),
      },
    } as Api.SimulateTransactionRestoreResponse;
    await simulateSep45Challenge(authorized, {
      rpc: rpcFixture({ response: restoration }),
      networkPassphrase: fixture.networkPassphrase,
      webAuthContractId: fixture.webAuthContractId,
    });

    const cases: Array<[Sep45Rpc, string]> = [
      [rpcFixture({ latestError: new Error("offline") }), Sep45Code.RPC_FAILED],
      [rpcFixture({ sequence: 106 }), Sep45Code.AUTHORIZATION_EXPIRED],
      [
        rpcFixture({ simulationError: new Error("offline") }),
        Sep45Code.RPC_FAILED,
      ],
      [
        rpcFixture({
          response: {
            id: "error",
            latestLedger: 101,
            events: [],
            _parsed: true,
            error: "denied",
          },
        }),
        Sep45Code.SIMULATION_FAILED,
      ],
      [
        rpcFixture({
          response: {
            id: "unknown",
            latestLedger: 101,
            events: [],
            _parsed: true,
          } as unknown as Api.SimulateTransactionResponse,
        }),
        Sep45Code.SIMULATION_FAILED,
      ],
      [
        rpcFixture({
          response: simulationSuccess(
            [],
            [nonceKey(Address.contract(Buffer.alloc(32, 5)).toString())],
          ),
        }),
        Sep45Code.UNSAFE_FOOTPRINT,
      ],
      [
        rpcFixture({
          response: {
            ...restoration,
            restorePreamble: {
              minResourceFee: "100",
              transactionData: new SorobanDataBuilder().setReadWrite([
                instanceKey(fixture.contractAccount),
              ]),
            },
          },
        }),
        Sep45Code.INVALID_RESTORATION,
      ],
    ];
    for (const [caseRpc, code] of cases) {
      assertEquals(
        (
          await assertRejects(
            () =>
              simulateSep45Challenge(authorized, {
                rpc: caseRpc,
                networkPassphrase: fixture.networkPassphrase,
                webAuthContractId: fixture.webAuthContractId,
              }),
            Sep45Error,
          )
        ).code,
        code,
      );
    }
  });

  it("Sep45Client completes request, authorization, simulation, and submission", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await buildSep45Challenge(fixture);
    const now = Math.floor(Date.now() / 1_000);
    const token = testJwt({
      iss: "https://issuer.test",
      sub: fixture.contractAccount,
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
            authorization_entries: challenge.xdr,
            network_passphrase: fixture.networkPassphrase,
          }),
        )
        : await new Response(JSON.stringify({ token }));
    };
    const client = clientFor(fixture, rpcFixture(), fetch);
    assertEquals(client.endpoint, `https://${fixture.webAuthDomain}/auth`);
    assertEquals(client.webAuthContractId, fixture.webAuthContractId);
    const result = await client.authenticate({
      account: fixture.contractAccount,
      authorize: ContractAuth.none(),
    });
    assertEquals(result.protocol, "sep45");
    assertEquals(result.account, fixture.contractAccount);
    assertEquals(
      new URL(requests[0].url).searchParams.get("home_domain"),
      fixture.homeDomain,
    );
    assertEquals(
      typeof JSON.parse(await requests[1].text()).authorization_entries,
      "string",
    );
  });

  it("Sep45Client performs client-domain discovery only when accepted", async () => {
    const fixture = createWebAuthFixture();
    const now = Math.floor(Date.now() / 1_000);
    for (const accepted of [false, true]) {
      const challenge = await buildSep45Challenge(fixture, {
        clientDomain: accepted,
      });
      let tomlFetches = 0;
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
        return request.method === "GET"
          ? await new Response(
            JSON.stringify({ authorization_entries: challenge.xdr }),
          )
          : await new Response(
            JSON.stringify({
              token: testJwt({
                iss: "https://issuer.test",
                sub: fixture.contractAccount,
                iat: now,
                exp: now + 100,
                ...(accepted ? { client_domain: "wallet.test" } : {}),
              }),
            }),
          );
      };
      const result = await clientFor(
        fixture,
        rpcFixture(),
        fetch,
      ).authenticate({
        account: fixture.contractAccount,
        clientDomain: "wallet.test",
        clientDomainSigner: fixture.clientDomain,
        authorize: ContractAuth.none(),
      });
      assertEquals(result.clientDomain, accepted ? "wallet.test" : undefined);
      assertEquals(tomlFetches, accepted ? 1 : 0);
    }
  });

  it("Sep45Client maps request, discovery, RPC, state, and token failures", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await buildSep45Challenge(fixture);
    const responseClient = (
      body: Record<string, unknown>,
      rpc = rpcFixture(),
    ) =>
      clientFor(
        fixture,
        rpc,
        async () => await new Response(JSON.stringify(body)),
      );

    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient({ authorization_entries: challenge.xdr })
              .getChallenge({ account: fixture.server.publicKey() }),
          Sep45Error,
        )
      ).code,
      Sep45Code.ACCOUNT_MISMATCH,
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient({}).getChallenge({
              account: fixture.contractAccount,
            }),
          Sep45Error,
        )
      ).code,
      Sep45Code.CLIENT_REQUEST_FAILED,
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient({
              authorization_entries: challenge.xdr,
              network_passphrase: "wrong",
            }).getChallenge({ account: fixture.contractAccount }),
          WebAuthError,
        )
      ).code,
      WebAuthCode.NETWORK_MISMATCH,
    );
    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient(
              { authorization_entries: challenge.xdr },
              rpcFixture({ latestError: new Error("offline") }),
            ).getChallenge({ account: fixture.contractAccount }),
          Sep45Error,
        )
      ).code,
      Sep45Code.RPC_FAILED,
    );

    const domainChallenge = await buildSep45Challenge(fixture, {
      clientDomain: true,
    });
    for (
      const [toml, code] of [
        ["bad toml =", Sep45Code.CLIENT_DOMAIN_DISCOVERY],
        ['VERSION = "2.0.0"', Sep45Code.CLIENT_DOMAIN_SIGNING_KEY],
      ] as const
    ) {
      const client = clientFor(
        fixture,
        rpcFixture(),
        async (input) =>
          String(input).includes("/.well-known/")
            ? await new Response(toml)
            : await new Response(
              JSON.stringify({ authorization_entries: domainChallenge.xdr }),
            ),
      );
      assertEquals(
        (
          await assertRejects(
            () =>
              client.getChallenge({
                account: fixture.contractAccount,
                clientDomain: "wallet.test",
              }),
            Sep45Error,
          )
        ).code,
        code,
      );
    }
    assertEquals(
      (
        await assertRejects(
          () =>
            responseClient({ authorization_entries: domainChallenge.xdr })
              .getChallenge({ account: fixture.contractAccount }),
          Sep45Error,
        )
      ).code,
      Sep45Code.CLIENT_DOMAIN_UNEXPECTED,
    );

    const verified = await responseClient({
      authorization_entries: challenge.xdr,
    }).getChallenge({ account: fixture.contractAccount });
    const authorized = await responseClient({
      authorization_entries: challenge.xdr,
    }).authorizeChallenge(verified, ContractAuth.none());
    const client = responseClient({ authorization_entries: challenge.xdr });
    assertEquals(
      (
        await assertRejects(
          () => client.prepareChallenge({} as Sep45AuthorizedChallenge),
          Sep45Error,
        )
      ).code,
      Sep45Code.INVALID_STATE,
    );
    assertEquals(
      (
        await assertRejects(
          () => client.submitChallenge({} as Sep45PreparedChallenge),
          Sep45Error,
        )
      ).code,
      Sep45Code.INVALID_STATE,
    );
    const prepared = await client.prepareChallenge(authorized);
    assertEquals(
      (
        await assertRejects(
          () => client.submitChallenge(prepared),
          Sep45Error,
        )
      ).code,
      Sep45Code.CLIENT_REQUEST_FAILED,
    );
    assertEquals(
      decodeSep45AuthorizationEntries(prepared.toXDR()).length,
      2,
    );
  });
});
