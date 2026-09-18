import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import { stub } from "@std/testing/mock";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { type EnvelopeSigner, LocalSigner, NetworkConfig } from "@colibri/core";
import {
  Keypair,
  type Transaction,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import {
  buildSep10Challenge,
  createWebAuthFixture,
  testJwt,
} from "colibri-internal/tests/helpers/webauth/fixtures.ts";
import { WebAuthClient } from "@/client.ts";
import { Sep10Error, Sep10SigningFailedError } from "@/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);

function setup(clientDomain?: string) {
  const fixture = createWebAuthFixture();
  const challengeXdr = buildSep10Challenge(fixture, { clientDomain });
  const posts: string[] = [];
  const client = new WebAuthClient({
    homeDomain: fixture.homeDomain,
    signingKey: fixture.server.publicKey(),
    network: NetworkConfig.TestNet(),
    sep10: { endpoint: `https://${fixture.webAuthDomain}/auth` },
    fetch: (input, init) => {
      const request = new Request(input, init);
      if (request.url.includes("/.well-known/")) {
        return Promise.resolve(
          new Response(`SIGNING_KEY = "${fixture.clientDomain.publicKey()}"`),
        );
      }
      if (request.method === "GET") {
        return Promise.resolve(Response.json({ transaction: challengeXdr }));
      }
      posts.push(String(init?.body));
      return Promise.resolve(Response.json({
        token: testJwt({
          iss: `https://${fixture.webAuthDomain}/auth`,
          sub: fixture.client.publicKey(),
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900,
          ...(clientDomain ? { client_domain: clientDomain } : {}),
        }),
      }));
    },
  });
  return { fixture, challengeXdr, posts, client };
}
function wallet(
  key: Keypair,
  action?: (tx: Transaction) => string | Promise<string>,
): EnvelopeSigner {
  const local = LocalSigner.fromKeypair(key);
  return {
    signerKey: local.signerKey,
    signsFor: local.signsFor,
    signTransaction: (tx) =>
      action
        ? action(
          TransactionBuilder.fromXdr(
            tx.toXdr(),
            tx.networkPassphrase,
          ) as Transaction,
        )
        : Promise.resolve(local.signTransaction(tx)),
  };
}

describe("SEP-10 asynchronous envelope signers", () => {
  it("awaits wallet approval through the unified client before exchanging a challenge", async () => {
    const { fixture, posts, client } = setup();
    const approved = Promise.withResolvers<void>();
    const prompted = Promise.withResolvers<void>();
    const signer = wallet(fixture.client, async (tx) => {
      prompted.resolve();
      await approved.promise;
      tx.sign(fixture.client);
      return tx.toXdr();
    });
    const pending = client.authenticate({
      account: fixture.client.publicKey(),
      signer,
    });
    await prompted.promise;
    assertEquals(posts, []);
    approved.resolve();
    const token = await pending;
    assertEquals(token.account, fixture.client.publicKey());
    assertEquals(posts.length, 1);
  });

  it("preserves server, SDK keypair, local, multisig and async client-domain signatures sequentially", async () => {
    const { fixture, challengeXdr, client } = setup("wallet.test");
    const challenge = await client.sep10.getChallenge({
      account: fixture.client.publicKey(),
      clientDomain: "wallet.test",
    });
    const second = Keypair.random();
    const third = Keypair.random();
    const signaturesSeen: number[] = [];
    const signer = wallet(third, async (tx) => {
      signaturesSeen.push(tx.signatures.length);
      await Promise.resolve();
      tx.sign(third);
      // Reordering existing signatures is harmless; none may be dropped.
      tx.signatures.reverse();
      return tx.toXdr();
    });
    const domain = wallet(fixture.clientDomain, (tx) => {
      signaturesSeen.push(tx.signatures.length);
      tx.sign(fixture.clientDomain);
      return Promise.resolve(tx.toXdr());
    });
    const signed = await client.sep10.signChallenge(
      challenge,
      [
        fixture.client,
        LocalSigner.fromKeypair(second),
        signer,
      ],
      domain,
      new AbortController().signal,
    );
    assertEquals(signaturesSeen, [3, 4]);
    assertEquals(signed.transaction.signatures.length, 5);
    for (
      const key of [
        fixture.server,
        fixture.client,
        second,
        third,
        fixture.clientDomain,
      ]
    ) {
      assert(
        signed.transaction.signatures.some((signature) =>
          key.verify(signed.transaction.hash(), signature.signature.toBytes())
        ),
      );
    }
    assertEquals(challenge.toXdr(), challengeXdr);
    assertEquals(challenge.transaction.signatures.length, 1);
    assertEquals(
      (await client.sep10.submitChallenge(signed)).clientDomain,
      "wallet.test",
    );
  });

  it("rejects wrong domain and non-Ed25519 signer identities before prompting", async () => {
    const { fixture, client } = setup("wallet.test");
    const challenge = await client.sep10.getChallenge({
      account: fixture.client.publicKey(),
      clientDomain: "wallet.test",
    });
    let prompts = 0;
    const signer = wallet(fixture.client, () => {
      prompts++;
      return "";
    });
    await assertRejects(
      () =>
        client.sep10.signChallenge(challenge, signer, wallet(Keypair.random())),
      Sep10Error,
    );
    for (const prefix of ["T", "X", "P", "C"]) {
      const invalid = {
        ...signer,
        signerKey: () =>
          `${prefix}unsupported` as ReturnType<EnvelopeSigner["signerKey"]>,
      };
      await assertRejects(
        () =>
          client.sep10.signChallenge(
            challenge,
            invalid,
            wallet(fixture.clientDomain),
          ),
        Sep10SigningFailedError,
      );
    }
    assertEquals(prompts, 0);
  });

  const invalidResults: Record<
    string,
    (tx: Transaction, key: Keypair) => string
  > = {
    malformed: () => "not XDR",
    unsigned: (tx) => tx.toXdr(),
    "changed transaction body": (tx, key) => {
      const changed = TransactionBuilder.cloneFrom(tx, { fee: "12345" })
        .build();
      changed.sign(key);
      return changed.toXdr();
    },
    "fee-bump envelope": (tx, key) => {
      const changed = TransactionBuilder.buildFeeBumpTransaction(
        key,
        "1000",
        tx,
        tx.networkPassphrase,
      );
      changed.sign(key);
      return changed.toXdr();
    },
    "stripped server signature": (tx, key) => {
      tx.signatures.splice(0);
      tx.sign(key);
      return tx.toXdr();
    },
    "modified server signature": (tx, key) => {
      tx.signatures[0] = new xdr.DecoratedSignature({
        hint: new Uint8Array(4),
        signature: new Uint8Array(64),
      });
      tx.sign(key);
      return tx.toXdr();
    },
    "wrong signing key": (tx) => {
      tx.sign(Keypair.random());
      return tx.toXdr();
    },
    "invalid signature with matching hint": (tx, key) => {
      tx.signatures.push(
        new xdr.DecoratedSignature({
          hint: key.signatureHint(),
          signature: new Uint8Array(64),
        }),
      );
      return tx.toXdr();
    },
    "wrong signature hint": (tx, key) => {
      tx.signatures.push(
        new xdr.DecoratedSignature({
          hint: new Uint8Array(4),
          signature: key.sign(tx.hash()),
        }),
      );
      return tx.toXdr();
    },
  };
  for (const [name, action] of Object.entries(invalidResults)) {
    it(`rejects ${name} without exchanging or mutating the original challenge`, async () => {
      const { fixture, client, posts, challengeXdr } = setup();
      const challenge = await client.sep10.getChallenge({
        account: fixture.client.publicKey(),
      });
      const signer = wallet(
        fixture.client,
        (tx) => Promise.resolve(action(tx, fixture.client)),
      );
      await assertRejects(
        () => client.sep10.signChallenge(challenge, signer),
        Sep10SigningFailedError,
      );
      assertEquals(posts, []);
      assertEquals(challenge.toXdr(), challengeXdr);
      assertEquals(challenge.transaction.signatures.length, 1);
    });
  }

  it("snapshots the body before a wallet mutates the supplied instance", async () => {
    const { fixture, client } = setup();
    const signer = wallet(fixture.client);
    signer.signTransaction = (tx) => {
      const supplied = tx as Transaction;
      supplied.signatures.splice(0);
      supplied.sign(fixture.client);
      return Promise.resolve(supplied.toXdr());
    };
    await assertRejects(
      () =>
        client.authenticate({ account: fixture.client.publicKey(), signer }),
      Sep10SigningFailedError,
    );
  });

  it("retains wallet rejection as the signing error cause and does not retry", async () => {
    const { fixture, posts, client } = setup();
    const rejected = new Error("user declined");
    let prompts = 0;
    const signer = wallet(fixture.client, () => {
      prompts++;
      return Promise.reject(rejected);
    });
    const error = await assertRejects(
      () =>
        client.authenticate({ account: fixture.client.publicKey(), signer }),
      Sep10SigningFailedError,
    );
    assertStrictEquals(error.meta?.cause, rejected);
    assertEquals(prompts, 1);
    assertEquals(posts, []);
  });

  it("rejects invalid challenges before any wallet approval", async () => {
    const { fixture } = setup();
    let prompts = 0;
    const client = new WebAuthClient({
      homeDomain: fixture.homeDomain,
      signingKey: fixture.server.publicKey(),
      network: NetworkConfig.TestNet(),
      sep10: { endpoint: `https://${fixture.webAuthDomain}/auth` },
      fetch: () =>
        Promise.resolve(
          Response.json({
            transaction: buildSep10Challenge(fixture, { sequence: "10" }),
          }),
        ),
    });
    await assertRejects(
      () =>
        client.authenticate({
          account: fixture.client.publicKey(),
          signer: wallet(fixture.client, () => {
            prompts++;
            return "";
          }),
        }),
      Sep10Error,
    );
    assertEquals(prompts, 0);
  });

  it("rechecks expiry before approval, after approval, and before token exchange", async () => {
    const { fixture, client, posts } = setup();
    const challenge = await client.sep10.getChallenge({
      account: fixture.client.publicKey(),
    });
    const now = Date.now();
    let clock = now;
    using _time = stub(Date, "now", () => clock);
    const signed = await client.sep10.signChallenge(challenge, fixture.client);
    clock = now + 1000000;
    await assertRejects(
      () => client.sep10.signChallenge(challenge, wallet(fixture.client)),
      Sep10Error,
      "expired",
    );
    await assertRejects(
      () => client.sep10.submitChallenge(signed),
      Sep10Error,
      "expired",
    );
    clock = now;
    await assertRejects(
      () =>
        client.sep10.signChallenge(
          challenge,
          wallet(fixture.client, (tx) => {
            clock = now + 1000000;
            tx.sign(fixture.client);
            return Promise.resolve(tx.toXdr());
          }),
        ),
      Sep10Error,
      "expired",
    );
    assertEquals(posts, []);
  });

  it("honors cancellation before retrieval and after delayed signing without another prompt or exchange", async () => {
    const { fixture, client, posts } = setup();
    const controller = new AbortController();
    const reason = new Error("session ended");
    let later = 0;
    const signer = wallet(fixture.client, (tx) => {
      controller.abort(reason);
      tx.sign(fixture.client);
      return Promise.resolve(tx.toXdr());
    });
    assertStrictEquals(
      await assertRejects(() =>
        client.authenticate({
          account: fixture.client.publicKey(),
          signer: [
            signer,
            wallet(Keypair.random(), () => {
              later++;
              return "";
            }),
          ],
          signal: controller.signal,
        })
      ),
      reason,
    );
    assertStrictEquals(
      await assertRejects(() =>
        client.authenticate({
          account: fixture.client.publicKey(),
          signer,
          signal: controller.signal,
        })
      ),
      reason,
    );
    assertEquals(later, 0);
    assertEquals(posts, []);
  });
});
