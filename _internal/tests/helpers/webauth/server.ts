// deno-coverage-ignore-file

import { Buffer } from "node:buffer";
import {
  Account,
  Address,
  authorizeEntry,
  Keypair,
  Memo,
  Operation,
  StrKey,
  type Transaction,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { Api, type Server as RpcServer } from "stellar-sdk/rpc";
import {
  decodeSep45AuthorizationEntries,
  encodeSep45AuthorizationEntries,
  Sep45AuthorizedChallenge,
  simulateSep45Challenge,
  verifySep10Challenge,
  verifySep45Challenge,
} from "@colibri/webauth";
import {
  createWebAuthFixture,
  sep45Arguments,
  sep45ArgumentScVal,
  testJwt,
} from "colibri-internal/tests/helpers/webauth/fixtures.ts";

/** Atomic, process-local single-use nonce store for integration tests. */
export class TestWebAuthNonceStore {
  readonly #issued = new Set<string>();
  readonly #used = new Set<string>();

  issue(nonce: string): void {
    this.#issued.add(nonce);
  }

  consume(nonce: string): boolean {
    if (!this.#issued.has(nonce) || this.#used.has(nonce)) return false;
    this.#used.add(nonce);
    return true;
  }
}

/** Configuration for the internal dual-protocol WebAuth server. */
export interface TestWebAuthServerConfig {
  networkPassphrase: string;
  rpc: RpcServer;
  webAuthContractId: string;
  server: Keypair;
  clientDomain?: {
    domain: string;
    account: string;
  };
}

/** Running internal WebAuth server fixture. */
export interface TestWebAuthServer {
  homeDomain: string;
  sep10Endpoint: string;
  sep45Endpoint: string;
  nonceStore: TestWebAuthNonceStore;
  close(): Promise<void>;
}

function json(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "access-control-allow-origin": "*",
    },
  });
}

async function postedValue(
  request: Request,
  key: string,
): Promise<string | undefined> {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)[key] as string | undefined
      : undefined;
  }
  return new URLSearchParams(await request.text()).get(key) ?? undefined;
}

function token(
  subject: string,
  clientDomain?: string,
): string {
  const now = Math.floor(Date.now() / 1_000);
  return testJwt({
    iss: "https://colibri.test/webauth",
    sub: subject,
    iat: now,
    exp: now + 300,
    ...(clientDomain ? { client_domain: clientDomain } : {}),
  });
}

function normalizeSep45Credential(
  entry: xdr.SorobanAuthorizationEntry,
): xdr.SorobanAuthorizationEntry {
  if (entry.credentials.type !== "sorobanCredentialsAddressV2") {
    return entry;
  }

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      entry.credentials.addressV2,
    ),
    rootInvocation: entry.rootInvocation,
  });
}

/** Starts a local in-memory SEP-10/SEP-45 server for Quickstart tests. */
export function startTestWebAuthServer(
  config: TestWebAuthServerConfig,
): TestWebAuthServer {
  const nonceStore = new TestWebAuthNonceStore();
  let homeDomain = "";

  function sep10Get(requestUrl: URL): Response {
    const account = requestUrl.searchParams.get("account");
    if (!account) return json({ error: "account required" }, 400);
    const memo = requestUrl.searchParams.get("memo") ?? undefined;
    const requestedClientDomain =
      requestUrl.searchParams.get("client_domain") ?? undefined;
    const acceptedClientDomain =
      requestedClientDomain === config.clientDomain?.domain
        ? requestedClientDomain
        : undefined;
    const nonce = crypto.getRandomValues(new Uint8Array(48));
    const nonceKey = Buffer.from(nonce).toString("base64");
    nonceStore.issue(nonceKey);
    const now = Math.floor(Date.now() / 1_000);
    const builder = new TransactionBuilder(
      new Account(config.server.publicKey(), "-1"),
      {
        fee: "100",
        networkPassphrase: config.networkPassphrase,
        timebounds: { minTime: now, maxTime: now + 300 },
      },
    );
    if (memo) builder.addMemo(Memo.id(memo));
    builder.addOperation(
      Operation.manageData({
        source: account,
        name: `${homeDomain} auth`,
        value: nonceKey,
      }),
    );
    builder.addOperation(
      Operation.manageData({
        source: config.server.publicKey(),
        name: "web_auth_domain",
        value: homeDomain,
      }),
    );
    if (acceptedClientDomain && config.clientDomain) {
      builder.addOperation(
        Operation.manageData({
          source: config.clientDomain.account,
          name: "client_domain",
          value: acceptedClientDomain,
        }),
      );
    }
    const transaction = builder.build();
    transaction.sign(config.server);
    return json({
      transaction: transaction.toXdr(),
      network_passphrase: config.networkPassphrase,
    });
  }

  async function sep10Post(request: Request): Promise<Response> {
    const transactionXdr = await postedValue(request, "transaction");
    if (!transactionXdr) return json({ error: "transaction required" }, 400);
    try {
      const transaction = TransactionBuilder.fromXdr(
        transactionXdr,
        config.networkPassphrase,
      ) as Transaction;
      const first = transaction.operations[0];
      if (
        first?.type !== "manageData" ||
        !first.source ||
        !first.value
      ) {
        throw new TypeError("invalid first operation");
      }
      const memo = transaction.memo.type === "id"
        ? String(transaction.memo.value)
        : undefined;
      const clientDomainOperation = transaction.operations.find(
        (operation) =>
          operation.type === "manageData" &&
          operation.name === "client_domain",
      );
      const clientDomain = clientDomainOperation?.type === "manageData" &&
          clientDomainOperation.value
        ? Buffer.from(clientDomainOperation.value).toString()
        : undefined;
      verifySep10Challenge({
        transactionXdr,
        networkPassphrase: config.networkPassphrase,
        serverAccount: config.server.publicKey(),
        account: first.source,
        memo,
        homeDomain,
        webAuthDomain: homeDomain,
        clientDomain,
        clientDomainAccount: clientDomain
          ? config.clientDomain?.account
          : undefined,
      });
      const clientKey = Keypair.fromPublicKey(first.source);
      if (
        !transaction.signatures.some((signature) =>
          clientKey.verify(transaction.hash(), signature.signature.toBytes())
        )
      ) {
        throw new TypeError("missing client signature");
      }
      if (
        clientDomain && config.clientDomain &&
        !transaction.signatures.some((signature) =>
          Keypair.fromPublicKey(config.clientDomain!.account).verify(
            transaction.hash(),
            signature.signature.toBytes(),
          )
        )
      ) {
        throw new TypeError("missing client-domain signature");
      }
      const nonce = Buffer.from(first.value).toString();
      if (!nonceStore.consume(nonce)) {
        return json({ error: "challenge already used" }, 409);
      }
      const subject = memo ? `${first.source}:${memo}` : first.source;
      return json({ token: token(subject, clientDomain) });
    } catch (cause) {
      return json({
        error: cause instanceof Error ? cause.message : String(cause),
      }, 400);
    }
  }

  async function sep45Get(requestUrl: URL): Promise<Response> {
    const account = requestUrl.searchParams.get("account");
    if (!account) return json({ error: "account required" }, 400);
    const requestedClientDomain =
      requestUrl.searchParams.get("client_domain") ?? undefined;
    const acceptedClientDomain =
      requestedClientDomain === config.clientDomain?.domain
        ? requestedClientDomain
        : undefined;
    const latestLedger = await config.rpc.getLatestLedger();
    const expiration = latestLedger.sequence + 30;
    const nonce = crypto.randomUUID();
    nonceStore.issue(nonce);
    const fixture = {
      ...createWebAuthFixture(),
      networkPassphrase: config.networkPassphrase,
      homeDomain,
      webAuthDomain: homeDomain,
      server: config.server,
      contractAccount: account,
      webAuthContractId: config.webAuthContractId,
    };
    const values = sep45Arguments(fixture, {
      nonce,
      client_domain: acceptedClientDomain,
      client_domain_account: acceptedClientDomain
        ? config.clientDomain?.account
        : undefined,
    });
    const recordingTransaction = new TransactionBuilder(
      new Account(
        StrKey.encodeEd25519PublicKey(Buffer.alloc(32)),
        "-1",
      ),
      {
        fee: "100",
        networkPassphrase: config.networkPassphrase,
      },
    )
      .addOperation(
        Operation.invokeContractFunction({
          contract: config.webAuthContractId,
          function: "web_auth_verify",
          args: [sep45ArgumentScVal(values)],
        }),
      )
      .setTimeout(0)
      .build();
    const recording = await config.rpc.simulateTransaction(
      recordingTransaction,
      undefined,
      "record",
    );
    if (Api.isSimulationError(recording) || !recording.result) {
      throw new TypeError(
        `Could not record SEP-45 authorization: ${
          Api.isSimulationError(recording)
            ? recording.error
            : "missing simulation result"
        }`,
      );
    }
    // Protocol 28 recording simulation emits AddressV2 credentials by
    // default. SEP-45 v0.1.1 still defines the legacy address arm, so the
    // reference server deliberately serves that exact challenge shape.
    const entries = recording.result.auth.map(normalizeSep45Credential);
    const serverIndex = entries.findIndex((entry) => {
      const credentials = entry.credentials;
      return credentials.type === "sorobanCredentialsAddress" &&
        Address.fromScAddress(credentials.address.address).toString() ===
          config.server.publicKey();
    });
    if (serverIndex === -1) {
      throw new TypeError("Recording simulation omitted the server entry");
    }
    entries[serverIndex] = await authorizeEntry(
      entries[serverIndex],
      config.server,
      expiration,
      config.networkPassphrase,
    );
    return json({
      authorization_entries: encodeSep45AuthorizationEntries(entries),
      network_passphrase: config.networkPassphrase,
    });
  }

  async function sep45Post(request: Request): Promise<Response> {
    const authorizationEntriesXdr = await postedValue(
      request,
      "authorization_entries",
    );
    if (!authorizationEntriesXdr) {
      return json({ error: "authorization_entries required" }, 400);
    }
    try {
      const entries = decodeSep45AuthorizationEntries(
        authorizationEntriesXdr,
      );
      const authorizedFunction = entries[0].rootInvocation.function;
      if (
        authorizedFunction.type !==
          "sorobanAuthorizedFunctionTypeContractFn"
      ) {
        throw new TypeError("SEP-45 challenge is not a contract invocation");
      }
      const firstArgument = authorizedFunction.contractFn.args[0];
      const firstMap = firstArgument.type === "scvMap"
        ? firstArgument.map
        : null;
      const nativeArguments = Object.fromEntries(
        (firstMap ?? []).map((entry) => {
          if (
            entry.key.type !== "scvSymbol" ||
            entry.val.type !== "scvString"
          ) {
            throw new TypeError("SEP-45 challenge map has invalid entries");
          }
          return [entry.key.sym.toString(), entry.val.str.toString()];
        }),
      );
      const latest = await config.rpc.getLatestLedger();
      const clientDomain = nativeArguments.client_domain;
      const verified = verifySep45Challenge({
        authorizationEntriesXdr,
        networkPassphrase: config.networkPassphrase,
        webAuthContractId: config.webAuthContractId,
        serverAccount: config.server.publicKey(),
        account: nativeArguments.account,
        homeDomain,
        webAuthDomain: homeDomain,
        clientDomain,
        clientDomainAccount: clientDomain
          ? config.clientDomain?.account
          : undefined,
        latestLedger: latest.sequence,
      });
      if (!nonceStore.consume(verified.arguments.nonce)) {
        return json({ error: "challenge already used" }, 409);
      }
      const clientCredentials = entries[verified.clientEntryIndex].credentials;
      if (clientCredentials.type !== "sorobanCredentialsAddress") {
        throw new TypeError("SEP-45 client entry is not a legacy address");
      }
      const clientExpiration =
        clientCredentials.address.signatureExpirationLedger;
      const authorized = new Sep45AuthorizedChallenge(
        verified,
        entries,
        clientExpiration,
      );
      await simulateSep45Challenge(authorized, {
        rpc: config.rpc,
        networkPassphrase: config.networkPassphrase,
        webAuthContractId: config.webAuthContractId,
      });
      return json({
        token: token(verified.account, verified.clientDomain),
      });
    } catch (cause) {
      return json({
        error: cause instanceof Error ? cause.message : String(cause),
      }, 400);
    }
  }

  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0 },
    async (request) => {
      const url = new URL(request.url);
      if (
        request.method === "OPTIONS" &&
        (url.pathname === "/sep10" || url.pathname === "/sep45")
      ) {
        return new Response(null, {
          status: 204,
          headers: { "access-control-allow-origin": "*" },
        });
      }
      if (request.method === "GET" && url.pathname === "/sep10") {
        return sep10Get(url);
      }
      if (request.method === "POST" && url.pathname === "/sep10") {
        return await sep10Post(request);
      }
      if (request.method === "GET" && url.pathname === "/sep45") {
        return await sep45Get(url);
      }
      if (request.method === "POST" && url.pathname === "/sep45") {
        return await sep45Post(request);
      }
      if (
        request.method === "GET" &&
        url.pathname === "/.well-known/stellar.toml"
      ) {
        return new Response(
          [
            `SIGNING_KEY = "${config.server.publicKey()}"`,
            `NETWORK_PASSPHRASE = "${config.networkPassphrase}"`,
            `WEB_AUTH_ENDPOINT = "http://${homeDomain}/sep10"`,
            `WEB_AUTH_FOR_CONTRACTS_ENDPOINT = "http://${homeDomain}/sep45"`,
            `WEB_AUTH_CONTRACT_ID = "${config.webAuthContractId}"`,
          ].join("\n"),
          { headers: { "content-type": "text/plain" } },
        );
      }
      return json({ error: "not found" }, 404);
    },
  );
  const address = server.addr as Deno.NetAddr;
  homeDomain = `${address.hostname}:${address.port}`;
  return {
    get homeDomain() {
      return homeDomain;
    },
    get sep10Endpoint() {
      return `http://${homeDomain}/sep10`;
    },
    get sep45Endpoint() {
      return `http://${homeDomain}/sep45`;
    },
    nonceStore,
    async close() {
      await server.shutdown();
    },
  };
}

/** Starts a standalone stellar.toml server for client-domain tests. */
export function startTestClientDomainServer(
  signingKey: string,
): {
  domain: string;
  close(): Promise<void>;
} {
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0 },
    (request) => {
      if (new URL(request.url).pathname !== "/.well-known/stellar.toml") {
        return new Response("not found", { status: 404 });
      }
      return new Response(`SIGNING_KEY = "${signingKey}"`);
    },
  );
  const address = server.addr as Deno.NetAddr;
  return {
    domain: `${address.hostname}:${address.port}`,
    async close() {
      await server.shutdown();
    },
  };
}
