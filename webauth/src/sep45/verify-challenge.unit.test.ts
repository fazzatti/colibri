import { Buffer } from "node:buffer";
import { assertEquals, assertNotStrictEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, Keypair, StrKey, xdr } from "stellar-sdk";
import {
  buildSep45Challenge,
  createWebAuthFixture,
  sep45Arguments,
  sep45ArgumentScVal,
  sep45Entry,
} from "colibri-internal/tests/helpers/webauth/fixtures.ts";
import {
  decodeSep45AuthorizationEntries,
  encodeSep45AuthorizationEntries,
} from "@/sep45/codec.ts";
import {
  hasSep45ClientDomainArguments,
  verifySep45Challenge,
} from "@/sep45/verify-challenge.ts";
import { Sep45Code, Sep45Error } from "@/error.ts";

type Fixture = ReturnType<typeof createWebAuthFixture>;

function verify(
  fixture: Fixture,
  authorizationEntriesXdr: string,
  overrides: Record<string, unknown> = {},
) {
  return verifySep45Challenge({
    authorizationEntriesXdr,
    networkPassphrase: fixture.networkPassphrase,
    webAuthContractId: fixture.webAuthContractId,
    serverAccount: fixture.server.publicKey(),
    account: fixture.contractAccount,
    homeDomain: fixture.homeDomain,
    webAuthDomain: fixture.webAuthDomain,
    latestLedger: 100,
    ...overrides,
  });
}

function expectCode(fn: () => unknown, code: string): void {
  assertEquals(assertThrows(fn, Sep45Error).code, code);
}

function withAddressSignature(
  entry: xdr.SorobanAuthorizationEntry,
  signature: xdr.ScVal,
): xdr.SorobanAuthorizationEntry {
  const credentials = entry.credentials;
  if (credentials.type !== "sorobanCredentialsAddress") {
    throw new Error("Expected legacy address credentials");
  }
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: credentials.address.address,
        nonce: credentials.address.nonce,
        signatureExpirationLedger:
          credentials.address.signatureExpirationLedger,
        signature,
      }),
    ),
    rootInvocation: entry.rootInvocation,
  });
}

describe("SEP-45 challenge verification", () => {
  it("SEP-45 codecs preserve exact variable-length entry arrays", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await buildSep45Challenge(fixture);
    const decoded = decodeSep45AuthorizationEntries(challenge.xdr);
    assertEquals(decoded.length, 2);
    assertEquals(encodeSep45AuthorizationEntries(decoded), challenge.xdr);
    assertNotStrictEquals(decoded[0], challenge.entries[0]);

    const empty = encodeSep45AuthorizationEntries([]);
    expectCode(
      () => decodeSep45AuthorizationEntries(empty),
      Sep45Code.EMPTY_ENTRIES,
    );
    for (
      const invalid of [
        "",
        "not base64",
        `${challenge.xdr}AAAA`,
        challenge.xdr.slice(0, -1),
      ]
    ) {
      expectCode(
        () => decodeSep45AuthorizationEntries(invalid),
        Sep45Code.INVALID_XDR,
      );
    }
  });

  it("verifySep45Challenge accepts reordered roles, arguments, and extensions", async () => {
    const fixture = createWebAuthFixture();
    const values = {
      ...sep45Arguments(fixture),
      application_hint: "preserved",
    };
    const extra = sep45Entry(
      fixture,
      StrKey.encodeContract(Buffer.alloc(32, 4)),
      { values },
    );
    const challenge = await buildSep45Challenge(fixture, {
      values,
      extraEntries: [extra],
      order: ["extra", "server", "client"],
    });
    const verified = verify(fixture, challenge.xdr);
    assertEquals(verified.clientEntryIndex, 2);
    assertEquals(verified.serverEntryIndex, 1);
    assertEquals(verified.entries.length, 3);
    assertEquals(verified.arguments.application_hint, "preserved");
    assertEquals(verified.extensionArguments, {
      application_hint: "preserved",
    });
    assertEquals(verified.serverExpirationLedger, 200);

    const reverseValues = Object.fromEntries(Object.entries(values).reverse());
    const reorderedClient = sep45Entry(fixture, fixture.contractAccount, {
      argument: sep45ArgumentScVal(
        reverseValues,
        Object.keys(reverseValues),
      ),
    });
    const entries = decodeSep45AuthorizationEntries(challenge.xdr);
    entries[2] = reorderedClient;
    assertEquals(
      verify(fixture, encodeSep45AuthorizationEntries(entries))
        .arguments.application_hint,
      "preserved",
    );
  });

  it("verifySep45Challenge accepts and binds a client domain", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await buildSep45Challenge(fixture, {
      clientDomain: true,
      order: ["clientDomain", "client", "server"],
    });
    assertEquals(hasSep45ClientDomainArguments(challenge.xdr), true);
    const verified = verify(fixture, challenge.xdr, {
      clientDomain: "wallet.test",
      clientDomainAccount: fixture.clientDomain.publicKey(),
    });
    assertEquals(verified.clientDomain, "wallet.test");
    assertEquals(
      verified.clientDomainAccount,
      fixture.clientDomain.publicKey(),
    );
    assertEquals(verified.clientDomainEntryIndex, 0);
    assertEquals(
      hasSep45ClientDomainArguments(
        encodeSep45AuthorizationEntries([
          sep45Entry(fixture, fixture.contractAccount, {
            argument: xdr.ScVal.scvString("not-a-map"),
          }),
        ]),
      ),
      false,
    );
    assertEquals(
      hasSep45ClientDomainArguments(
        encodeSep45AuthorizationEntries([
          sep45Entry(fixture, fixture.contractAccount, {
            values: {
              client_domain_account: fixture.clientDomain.publicKey(),
            },
          }),
        ]),
      ),
      true,
    );
    for (
      const argument of [
        xdr.ScVal.scvMap(null),
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvString("client_domain"),
            val: xdr.ScVal.scvString("wallet.test"),
          }),
        ]),
      ]
    ) {
      assertEquals(
        hasSep45ClientDomainArguments(
          encodeSep45AuthorizationEntries([
            sep45Entry(fixture, fixture.contractAccount, { argument }),
          ]),
        ),
        false,
      );
    }
  });

  it("verifySep45Challenge rejects unsupported credential variants", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await buildSep45Challenge(fixture);
    const source = sep45Entry(fixture, fixture.contractAccount, {
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    });
    const entries = decodeSep45AuthorizationEntries(challenge.xdr);
    entries[0] = source;
    expectCode(
      () => verify(fixture, encodeSep45AuthorizationEntries(entries)),
      Sep45Code.INVALID_ROLE,
    );

    const legacyEntry = sep45Entry(fixture, fixture.contractAccount);
    if (legacyEntry.credentials.type !== "sorobanCredentialsAddress") {
      throw new Error("Expected legacy address credentials");
    }
    const legacy = legacyEntry.credentials.address;
    entries[0] = sep45Entry(fixture, fixture.contractAccount, {
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddressV2(legacy),
    });
    expectCode(
      () => verify(fixture, encodeSep45AuthorizationEntries(entries)),
      Sep45Code.UNSUPPORTED_CREDENTIAL_TYPE,
    );
  });

  it("verifySep45Challenge rejects malformed invocations", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await buildSep45Challenge(fixture);
    const cases: Array<[xdr.SorobanAuthorizationEntry, string]> = [
      [
        sep45Entry(fixture, fixture.contractAccount, {
          contractId: StrKey.encodeContract(Buffer.alloc(32, 8)),
        }),
        Sep45Code.INVALID_INVOCATION,
      ],
      [
        sep45Entry(fixture, fixture.contractAccount, {
          functionName: "other",
        }),
        Sep45Code.INVALID_INVOCATION,
      ],
      [
        sep45Entry(fixture, fixture.contractAccount, {
          subInvocations: [
            sep45Entry(fixture, fixture.contractAccount).rootInvocation,
          ],
        }),
        Sep45Code.INVALID_INVOCATION,
      ],
      [
        sep45Entry(fixture, fixture.contractAccount, {
          argument: xdr.ScVal.scvString("not-a-map"),
        }),
        Sep45Code.INVALID_ARGUMENTS,
      ],
    ];

    const originalCreateContract = sep45Entry(
      fixture,
      fixture.contractAccount,
    );
    const createContract = new xdr.SorobanAuthorizationEntry({
      credentials: originalCreateContract.credentials,
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction
          .sorobanAuthorizedFunctionTypeCreateContractHostFn(
            new xdr.CreateContractArgs({
              contractIdPreimage: xdr.ContractIdPreimage
                .contractIdPreimageFromAddress(
                  new xdr.ContractIdPreimageFromAddress({
                    address: Address.fromString(fixture.server.publicKey())
                      .toScAddress(),
                    salt: Buffer.alloc(32),
                  }),
                ),
              executable: xdr.ContractExecutable.contractExecutableWasm(
                Buffer.alloc(32),
              ),
            }),
          ),
        subInvocations: originalCreateContract.rootInvocation.subInvocations,
      }),
    });
    assertEquals(
      hasSep45ClientDomainArguments(
        encodeSep45AuthorizationEntries([createContract]),
      ),
      false,
    );
    cases.push([createContract, Sep45Code.INVALID_INVOCATION]);

    for (const [client, code] of cases) {
      const entries = decodeSep45AuthorizationEntries(challenge.xdr);
      entries[0] = client;
      expectCode(
        () => verify(fixture, encodeSep45AuthorizationEntries(entries)),
        code,
      );
    }
  });

  it("verifySep45Challenge rejects malformed and inconsistent maps", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await buildSep45Challenge(fixture);
    const entries = decodeSep45AuthorizationEntries(challenge.xdr);
    const original = sep45ArgumentScVal(sep45Arguments(fixture));
    if (original.type !== "scvMap" || !original.map) {
      throw new Error("Expected a SEP-45 argument map");
    }
    const duplicate = xdr.ScVal.scvMap([...original.map, original.map[0]]);
    const malformedArguments = [
      duplicate,
      xdr.ScVal.scvMap(null),
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvString("account"),
          val: xdr.ScVal.scvString(fixture.contractAccount),
        }),
      ]),
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("account"),
          val: xdr.ScVal.scvSymbol("not-string"),
        }),
      ]),
    ];
    for (const argument of malformedArguments) {
      entries[0] = sep45Entry(fixture, fixture.contractAccount, { argument });
      expectCode(
        () => verify(fixture, encodeSep45AuthorizationEntries(entries)),
        Sep45Code.INVALID_ARGUMENTS,
      );
    }

    entries[0] = sep45Entry(fixture, fixture.contractAccount, {
      values: {
        ...sep45Arguments(fixture),
        extension: "different",
      },
    });
    expectCode(
      () => verify(fixture, encodeSep45AuthorizationEntries(entries)),
      Sep45Code.ARGUMENTS_MISMATCH,
    );
  });

  it("verifySep45Challenge binds every required argument", async () => {
    const fixture = createWebAuthFixture();
    const required: Array<[string, string | undefined, string]> = [
      ["account", Keypair.random().publicKey(), Sep45Code.ACCOUNT_MISMATCH],
      ["home_domain", "wrong.test", Sep45Code.INVALID_ARGUMENTS],
      ["web_auth_domain", "wrong.test", Sep45Code.INVALID_ARGUMENTS],
      [
        "web_auth_domain_account",
        Keypair.random().publicKey(),
        Sep45Code.INVALID_ARGUMENTS,
      ],
      ["nonce", "", Sep45Code.INVALID_ARGUMENTS],
    ];
    for (const [key, value, code] of required) {
      const challenge = await buildSep45Challenge(fixture, {
        values: sep45Arguments(fixture, { [key]: value }),
      });
      expectCode(() => verify(fixture, challenge.xdr), code);
    }
  });

  it("verifySep45Challenge enforces required unique roles", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await buildSep45Challenge(fixture);
    const entries = decodeSep45AuthorizationEntries(challenge.xdr);
    for (
      const invalid of [
        [entries[1]],
        [entries[0]],
        [entries[0], entries[0], entries[1]],
        [entries[0], entries[1], entries[1]],
      ]
    ) {
      expectCode(
        () => verify(fixture, encodeSep45AuthorizationEntries(invalid)),
        Sep45Code.INVALID_ROLE,
      );
    }
  });

  it("verifySep45Challenge enforces client-domain pairing and role", async () => {
    const fixture = createWebAuthFixture();
    const cases: Array<{
      values: Record<string, string>;
      input?: Record<string, unknown>;
      clientDomainEntry?: boolean;
      code: string;
    }> = [
      {
        values: sep45Arguments(fixture, { client_domain: "wallet.test" }),
        code: Sep45Code.INVALID_ARGUMENTS,
      },
      {
        values: sep45Arguments(fixture, {
          client_domain_account: fixture.clientDomain.publicKey(),
        }),
        code: Sep45Code.INVALID_ARGUMENTS,
      },
      {
        values: sep45Arguments(fixture, {
          client_domain: "wallet.test",
          client_domain_account: fixture.clientDomain.publicKey(),
        }),
        code: Sep45Code.CLIENT_DOMAIN_UNEXPECTED,
      },
      {
        values: sep45Arguments(fixture, {
          client_domain: "wallet.test",
          client_domain_account: fixture.clientDomain.publicKey(),
        }),
        input: { clientDomain: "wrong.test" },
        code: Sep45Code.INVALID_ARGUMENTS,
      },
      {
        values: sep45Arguments(fixture, {
          client_domain: "wallet.test",
          client_domain_account: fixture.clientDomain.publicKey(),
        }),
        input: { clientDomain: "wallet.test" },
        code: Sep45Code.CLIENT_DOMAIN_SIGNING_KEY,
      },
      {
        values: sep45Arguments(fixture, {
          client_domain: "wallet.test",
          client_domain_account: fixture.clientDomain.publicKey(),
        }),
        input: {
          clientDomain: "wallet.test",
          clientDomainAccount: fixture.clientDomain.publicKey(),
        },
        code: Sep45Code.INVALID_ROLE,
      },
      {
        values: sep45Arguments(fixture),
        input: {
          clientDomainAccount: fixture.clientDomain.publicKey(),
        },
        clientDomainEntry: true,
        code: Sep45Code.INVALID_ROLE,
      },
    ];
    for (const item of cases) {
      const clientDomainEntry = item.clientDomainEntry
        ? [
          sep45Entry(fixture, fixture.clientDomain.publicKey(), {
            values: item.values,
          }),
        ]
        : [];
      const challenge = await buildSep45Challenge(fixture, {
        values: item.values,
        extraEntries: clientDomainEntry,
      });
      expectCode(
        () => verify(fixture, challenge.xdr, item.input),
        item.code,
      );
    }
  });

  it("verifySep45Challenge verifies server signature and expiration", async () => {
    const fixture = createWebAuthFixture();
    const challenge = await buildSep45Challenge(fixture);
    const entries = decodeSep45AuthorizationEntries(challenge.xdr);
    entries[1] = withAddressSignature(entries[1], xdr.ScVal.scvVoid());
    const vectorError = assertThrows(
      () => verify(fixture, encodeSep45AuthorizationEntries(entries)),
      Sep45Error,
    );
    assertEquals(vectorError.code, Sep45Code.SERVER_SIGNATURE_NOT_VECTOR);
    assertEquals(
      vectorError.message,
      "SEP-45 server signature must be a vector",
    );

    entries[1] = withAddressSignature(
      entries[1],
      xdr.ScVal.scvVec([xdr.ScVal.scvString("not-a-signature-map")]),
    );
    const signatureError = assertThrows(
      () => verify(fixture, encodeSep45AuthorizationEntries(entries)),
      Sep45Error,
    );
    assertEquals(signatureError.code, Sep45Code.NO_MATCHING_SERVER_SIGNATURE);
    assertEquals(
      signatureError.message,
      "SEP-45 server entry has no matching Ed25519 signature",
    );

    entries[1] = withAddressSignature(
      entries[1],
      xdr.ScVal.scvVec([
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("public_key"),
            val: xdr.ScVal.scvBytes(Buffer.alloc(32, 1)),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("signature"),
            val: xdr.ScVal.scvBytes(Buffer.alloc(64, 2)),
          }),
        ]),
      ]),
    );
    expectCode(
      () => verify(fixture, encodeSep45AuthorizationEntries(entries)),
      Sep45Code.NO_MATCHING_SERVER_SIGNATURE,
    );

    const sdkError = assertThrows(
      () =>
        verify(fixture, challenge.xdr, {
          networkPassphrase: Symbol("invalid"),
        }),
      Sep45Error,
    );
    assertEquals(
      sdkError.code,
      Sep45Code.FAILED_TO_VERIFY_SERVER_SIGNATURE,
    );
    assertEquals(
      sdkError.message,
      "SEP-45 server entry has an invalid signature",
    );

    const expired = await buildSep45Challenge(fixture, { expiration: 100 });
    expectCode(
      () => verify(fixture, expired.xdr, { latestLedger: 100 }),
      Sep45Code.SERVER_ENTRY_EXPIRED,
    );
  });

  it("verifySep45Challenge rejects duplicate client-domain roles", async () => {
    const fixture = createWebAuthFixture();
    const values = sep45Arguments(fixture, {
      client_domain: "wallet.test",
      client_domain_account: fixture.clientDomain.publicKey(),
    });
    const duplicate = sep45Entry(
      fixture,
      fixture.clientDomain.publicKey(),
      { values },
    );
    const challenge = await buildSep45Challenge(fixture, {
      values,
      clientDomain: true,
      extraEntries: [duplicate],
      order: ["client", "server", "clientDomain", "extra"],
    });
    expectCode(
      () =>
        verify(fixture, challenge.xdr, {
          clientDomain: "wallet.test",
          clientDomainAccount: fixture.clientDomain.publicKey(),
        }),
      Sep45Code.INVALID_ROLE,
    );
  });
});
