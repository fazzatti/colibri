// deno-coverage-ignore-file

import { Buffer } from "buffer";
import {
  Account,
  Address,
  authorizeEntry,
  Keypair,
  Memo,
  Operation,
  StrKey,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { encodeSep45AuthorizationEntries } from "@colibri/webauth/sep45";

/** Encodes an unsigned test JWT with the provided payload. */
export function testJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.signature`;
}

/** Deterministic default values shared by WebAuth protocol fixtures. */
export interface WebAuthFixture {
  networkPassphrase: string;
  homeDomain: string;
  webAuthDomain: string;
  server: Keypair;
  client: Keypair;
  clientDomain: Keypair;
  contractAccount: string;
  webAuthContractId: string;
}

/** Creates fresh account material for an isolated test. */
export function createWebAuthFixture(): WebAuthFixture {
  return {
    networkPassphrase: "Test SDF Network ; September 2015",
    homeDomain: "example.test",
    webAuthDomain: "auth.example.test",
    server: Keypair.random(),
    client: Keypair.random(),
    clientDomain: Keypair.random(),
    contractAccount: StrKey.encodeContract(
      Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
    ),
    webAuthContractId: StrKey.encodeContract(
      Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
    ),
  };
}

/** Options for constructing a SEP-10 challenge fixture. */
export interface Sep10FixtureOptions {
  account?: string;
  memo?: string;
  homeDomain?: string;
  webAuthDomain?: string;
  clientDomain?: string;
  clientDomainAccount?: string;
  minTime?: number;
  maxTime?: number;
  sequence?: string;
  laterOperation?: ReturnType<typeof Operation.manageData>;
  omitWebAuthDomain?: boolean;
  signServer?: boolean;
}

/** Builds server-signed SEP-10 transaction-envelope XDR. */
export function buildSep10Challenge(
  fixture: WebAuthFixture,
  options: Sep10FixtureOptions = {},
): string {
  const now = Math.floor(Date.now() / 1_000);
  const account = options.account ?? fixture.client.publicKey();
  const builder = new TransactionBuilder(
    new Account(fixture.server.publicKey(), options.sequence ?? "-1"),
    {
      fee: "100",
      networkPassphrase: fixture.networkPassphrase,
      timebounds: {
        minTime: options.minTime ?? now - 1,
        maxTime: options.maxTime ?? now + 900,
      },
    },
  );
  if (options.memo !== undefined) {
    builder.addMemo(Memo.id(options.memo));
  }
  builder.addOperation(
    Operation.manageData({
      source: account,
      name: `${options.homeDomain ?? fixture.homeDomain} auth`,
      value: Buffer.alloc(48, 7).toString("base64"),
    }),
  );
  if (!options.omitWebAuthDomain) {
    builder.addOperation(
      Operation.manageData({
        source: fixture.server.publicKey(),
        name: "web_auth_domain",
        value: options.webAuthDomain ?? fixture.webAuthDomain,
      }),
    );
  }
  if (options.clientDomain !== undefined) {
    builder.addOperation(
      Operation.manageData({
        source: options.clientDomainAccount ?? fixture.clientDomain.publicKey(),
        name: "client_domain",
        value: options.clientDomain,
      }),
    );
  }
  if (options.laterOperation) {
    builder.addOperation(options.laterOperation);
  }
  const transaction = builder.build();
  if (options.signServer ?? true) {
    transaction.sign(fixture.server);
  }
  return transaction.toXDR();
}

/** SEP-45 argument fixture. */
export function sep45Arguments(
  fixture: WebAuthFixture,
  overrides: Record<string, string | undefined> = {},
): Record<string, string> {
  const values: Record<string, string | undefined> = {
    account: fixture.contractAccount,
    home_domain: fixture.homeDomain,
    web_auth_domain: fixture.webAuthDomain,
    web_auth_domain_account: fixture.server.publicKey(),
    nonce: "fixture-nonce",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] =>
      entry[1] !== undefined
    ),
  );
}

/** Builds the single Symbol-to-String SEP-45 invocation argument. */
export function sep45ArgumentScVal(
  values: Record<string, string>,
  order = Object.keys(values).sort(),
): xdr.ScVal {
  return xdr.ScVal.scvMap(
    order.map((key) =>
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol(key),
        val: xdr.ScVal.scvString(values[key]),
      })
    ),
  );
}

/** Creates one legacy-address SEP-45 authorization entry. */
export function sep45Entry(
  fixture: WebAuthFixture,
  address: string,
  options: {
    values?: Record<string, string>;
    argument?: xdr.ScVal;
    expiration?: number;
    nonce?: string;
    contractId?: string;
    functionName?: string;
    subInvocations?: xdr.SorobanAuthorizedInvocation[];
    credentials?: xdr.SorobanCredentials;
  } = {},
): xdr.SorobanAuthorizationEntry {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction
      .sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(
            options.contractId ?? fixture.webAuthContractId,
          ).toScAddress(),
          functionName: options.functionName ?? "web_auth_verify",
          args: [
            options.argument ??
              sep45ArgumentScVal(
                options.values ?? sep45Arguments(fixture),
              ),
          ],
        }),
      ),
    subInvocations: options.subInvocations ?? [],
  });
  return new xdr.SorobanAuthorizationEntry({
    credentials: options.credentials ??
      xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: Address.fromString(address).toScAddress(),
          nonce: xdr.Int64.fromString(options.nonce ?? "42"),
          signatureExpirationLedger: options.expiration ?? 200,
          signature: xdr.ScVal.scvVoid(),
        }),
      ),
    rootInvocation: invocation,
  });
}

/** Builds a complete SEP-45 challenge and signs its server entry. */
export async function buildSep45Challenge(
  fixture: WebAuthFixture,
  options: {
    values?: Record<string, string>;
    clientDomain?: boolean;
    extraEntries?: xdr.SorobanAuthorizationEntry[];
    order?: Array<"client" | "server" | "clientDomain" | "extra">;
    expiration?: number;
  } = {},
): Promise<{
  entries: xdr.SorobanAuthorizationEntry[];
  xdr: string;
}> {
  const values = options.values ??
    sep45Arguments(
      fixture,
      options.clientDomain
        ? {
          client_domain: "wallet.test",
          client_domain_account: fixture.clientDomain.publicKey(),
        }
        : {},
    );
  const client = sep45Entry(fixture, fixture.contractAccount, {
    values,
    expiration: 0,
  });
  const serverUnsigned = sep45Entry(fixture, fixture.server.publicKey(), {
    values,
    expiration: options.expiration ?? 200,
  });
  const server = await authorizeEntry(
    serverUnsigned,
    fixture.server,
    options.expiration ?? 200,
    fixture.networkPassphrase,
  );
  const clientDomain = options.clientDomain
    ? sep45Entry(fixture, fixture.clientDomain.publicKey(), {
      values,
      expiration: 0,
    })
    : undefined;
  const extra = options.extraEntries ?? [];
  const order = options.order ??
    [
      "client",
      "server",
      ...(clientDomain ? ["clientDomain" as const] : []),
      ...(extra.length ? ["extra" as const] : []),
    ];
  const entries = order.flatMap((role) => {
    if (role === "client") return [client];
    if (role === "server") return [server];
    if (role === "clientDomain") return clientDomain ? [clientDomain] : [];
    return extra;
  });
  return {
    entries,
    xdr: encodeSep45AuthorizationEntries(entries),
  };
}
