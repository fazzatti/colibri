/**
 * SEP-10 Challenge Unit Tests
 */
// deno-lint-ignore-file no-explicit-any

import {
  assertEquals,
  assertThrows,
  assertInstanceOf,
  assertNotStrictEquals,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Memo,
  Account,
  Asset,
} from "stellar-sdk";
import { Buffer } from "buffer";
import type { Signer } from "@colibri/core";
import { SEP10Challenge } from "@/challenge/challenge.ts";
import * as E from "@/challenge/error.ts";

// =============================================================================
// Test Fixtures
// =============================================================================

const SERVER_KEYPAIR = Keypair.random();
const SERVER_PUBLIC_KEY = SERVER_KEYPAIR.publicKey();
const CLIENT_KEYPAIR = Keypair.random();
const CLIENT_PUBLIC_KEY = CLIENT_KEYPAIR.publicKey();
const CLIENT_DOMAIN_KEYPAIR = Keypair.random();
const CLIENT_DOMAIN_PUBLIC_KEY = CLIENT_DOMAIN_KEYPAIR.publicKey();

const HOME_DOMAIN = "example.com";
const WEB_AUTH_DOMAIN = "auth.example.com";
const CLIENT_DOMAIN = "wallet.example.com";
const NETWORK_PASSPHRASE = Networks.TESTNET;

/**
 * Creates a valid SEP-10 challenge transaction for testing
 */
function createValidChallenge(
  options: {
    serverKeypair?: Keypair;
    clientAccount?: string;
    homeDomain?: string;
    webAuthDomain?: string;
    clientDomain?: string;
    clientDomainAccount?: string;
    memo?: string;
    timeout?: number;
    sequenceNumber?: string;
    nonce?: string;
    skipServerSignature?: boolean;
  } = {}
): string {
  const {
    serverKeypair = SERVER_KEYPAIR,
    clientAccount = CLIENT_PUBLIC_KEY,
    homeDomain = HOME_DOMAIN,
    webAuthDomain = WEB_AUTH_DOMAIN,
    clientDomain,
    clientDomainAccount,
    memo,
    timeout = 900,
    sequenceNumber = "0",
    nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString(
      "base64"
    ),
    skipServerSignature = false,
  } = options;

  const now = Math.floor(Date.now() / 1000);
  const serverAccount = serverKeypair.publicKey();

  // Create account with adjustable sequence for testing
  const account = new Account(
    serverAccount,
    String(parseInt(sequenceNumber) - 1)
  );

  const builder = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
    timebounds: {
      minTime: now,
      maxTime: now + timeout,
    },
  });

  // Add memo if provided
  if (memo) {
    builder.addMemo(Memo.id(memo));
  }

  // First operation: client auth
  builder.addOperation(
    Operation.manageData({
      source: clientAccount,
      name: `${homeDomain} auth`,
      value: nonce,
    })
  );

  // web_auth_domain operation
  if (webAuthDomain) {
    builder.addOperation(
      Operation.manageData({
        source: serverAccount,
        name: "web_auth_domain",
        value: webAuthDomain,
      })
    );
  }

  // client_domain operation
  if (clientDomain && clientDomainAccount) {
    builder.addOperation(
      Operation.manageData({
        source: clientDomainAccount,
        name: "client_domain",
        value: clientDomain,
      })
    );
  }

  // Don't call setTimeout - timebounds already set in builder options
  const transaction = builder.build();

  if (!skipServerSignature) {
    transaction.sign(serverKeypair);
  }

  return transaction.toXDR();
}

// =============================================================================
// Tests
// =============================================================================

describe("SEP10Challenge", () => {
  describe("fromXDR", () => {
    it("parses a valid challenge transaction", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertEquals(challenge.serverAccount, SERVER_PUBLIC_KEY);
      assertEquals(challenge.clientAccount, CLIENT_PUBLIC_KEY);
      assertEquals(challenge.homeDomain, HOME_DOMAIN);
      assertEquals(challenge.webAuthDomain, WEB_AUTH_DOMAIN);
      assertEquals(challenge.networkPassphrase, NETWORK_PASSPHRASE);
      assertEquals(challenge.memo, undefined);
      assertEquals(challenge.clientDomain, undefined);
    });

    it("throws INVALID_XDR for invalid base64", () => {
      assertThrows(
        () => SEP10Challenge.fromXDR("not-valid-xdr!!!", NETWORK_PASSPHRASE),
        E.INVALID_XDR
      );
    });

    it("throws INVALID_SEQUENCE for non-zero sequence", () => {
      const xdr = createValidChallenge({ sequenceNumber: "12345" });
      assertThrows(
        () => SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE),
        E.INVALID_SEQUENCE
      );
    });

    it("parses challenge with memo", () => {
      const xdr = createValidChallenge({ memo: "12345" });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertEquals(challenge.memo, "12345");
    });

    it("parses challenge with client_domain", () => {
      const xdr = createValidChallenge({
        clientDomain: CLIENT_DOMAIN,
        clientDomainAccount: CLIENT_DOMAIN_PUBLIC_KEY,
      });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertEquals(challenge.clientDomain, CLIENT_DOMAIN);
      assertEquals(challenge.clientDomainAccount, CLIENT_DOMAIN_PUBLIC_KEY);
    });

    it("extracts nonce from first operation", () => {
      const testNonce = Buffer.from(
        crypto.getRandomValues(new Uint8Array(48))
      ).toString("base64");
      const xdr = createValidChallenge({ nonce: testNonce });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertEquals(challenge.nonce.toString(), testNonce);
    });
  });

  describe("fromTransaction", () => {
    it("throws INVALID_FIRST_OPERATION for non-ManageData first op", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.payment({
            destination: CLIENT_PUBLIC_KEY,
            asset: Asset.native(),
            amount: "1",
          })
        )
        .build();

      assertThrows(
        () => SEP10Challenge.fromTransaction(transaction, NETWORK_PASSPHRASE),
        E.INVALID_FIRST_OPERATION
      );
    });

    it("throws CLIENT_ACCOUNT_MISMATCH when first op has no source", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .build();

      assertThrows(
        () => SEP10Challenge.fromTransaction(transaction, NETWORK_PASSPHRASE),
        E.CLIENT_ACCOUNT_MISMATCH
      );
    });

    it("throws INVALID_HOME_DOMAIN for invalid key format", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: "invalid-key-format",
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .build();

      assertThrows(
        () => SEP10Challenge.fromTransaction(transaction, NETWORK_PASSPHRASE),
        E.INVALID_HOME_DOMAIN
      );
    });

    it("throws INVALID_NONCE for wrong nonce length", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: "too-short",
          })
        )
        .build();

      assertThrows(
        () => SEP10Challenge.fromTransaction(transaction, NETWORK_PASSPHRASE),
        E.INVALID_NONCE
      );
    });

    it("throws NO_OPERATIONS for empty transaction", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      // Build a valid transaction first, then manipulate it
      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .build();

      // Force empty operations array to test defensive code
      (transaction as any)._operations = [];

      assertThrows(
        () => SEP10Challenge.fromTransaction(transaction, NETWORK_PASSPHRASE),
        E.NO_OPERATIONS
      );
    });
  });

  describe("build", () => {
    it("builds a valid challenge transaction", () => {
      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        webAuthDomain: WEB_AUTH_DOMAIN,
      });

      assertEquals(challenge.serverAccount, SERVER_PUBLIC_KEY);
      assertEquals(challenge.clientAccount, CLIENT_PUBLIC_KEY);
      assertEquals(challenge.homeDomain, HOME_DOMAIN);
      assertEquals(challenge.webAuthDomain, WEB_AUTH_DOMAIN);
      assertEquals(challenge.nonce.length, 64);
    });

    it("builds challenge with client_domain", () => {
      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        clientDomain: CLIENT_DOMAIN,
        clientDomainAccount: CLIENT_DOMAIN_PUBLIC_KEY,
      });

      assertEquals(challenge.clientDomain, CLIENT_DOMAIN);
      assertEquals(challenge.clientDomainAccount, CLIENT_DOMAIN_PUBLIC_KEY);
    });

    it("builds challenge with memo", () => {
      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        memo: "12345",
      });

      assertEquals(challenge.memo, "12345");
    });

    it("throws MUXED_ACCOUNT_WITH_MEMO when muxed account has memo", () => {
      // Generate a muxed account address
      const muxedAccount =
        "MAQAA5L65LSYH7CQ3VTJ7F3HHLGCL3DSLAR2Y47263D56MNNGHSQSAAAAAAAAAAE2LP26";

      assertThrows(
        () =>
          SEP10Challenge.build({
            serverAccount: SERVER_PUBLIC_KEY,
            clientAccount: muxedAccount,
            homeDomain: HOME_DOMAIN,
            networkPassphrase: NETWORK_PASSPHRASE,
            memo: "12345",
          }),
        E.MUXED_ACCOUNT_WITH_MEMO
      );
    });

    it("uses custom timeout", () => {
      const challenge = SEP10Challenge.build({
        serverAccount: SERVER_PUBLIC_KEY,
        clientAccount: CLIENT_PUBLIC_KEY,
        homeDomain: HOME_DOMAIN,
        networkPassphrase: NETWORK_PASSPHRASE,
        timeout: 300,
      });

      const minTime = challenge.timeBounds.minTime.getTime();
      const maxTime = challenge.timeBounds.maxTime.getTime();
      const diffSeconds = (maxTime - minTime) / 1000;

      assertEquals(diffSeconds, 300);
    });
  });

  describe("verify", () => {
    it("verifies a valid challenge", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Should not throw
      challenge.verify(SERVER_PUBLIC_KEY);
    });

    it("throws INVALID_SERVER_SIGNATURE for wrong server key", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);
      const wrongKey = Keypair.random().publicKey();

      assertThrows(
        () => challenge.verify(wrongKey),
        E.INVALID_SERVER_SIGNATURE
      );
    });

    it("throws INVALID_SERVER_SIGNATURE for unsigned challenge", () => {
      const xdr = createValidChallenge({ skipServerSignature: true });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertThrows(
        () => challenge.verify(SERVER_PUBLIC_KEY),
        E.INVALID_SERVER_SIGNATURE
      );
    });

    it("throws CHALLENGE_EXPIRED for expired challenge", () => {
      const xdr = createValidChallenge({ timeout: -100 }); // Already expired
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertThrows(
        () => challenge.verify(SERVER_PUBLIC_KEY),
        E.CHALLENGE_EXPIRED
      );
    });

    it("allows expired challenge when allowExpired is true", () => {
      const xdr = createValidChallenge({ timeout: -100 });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Should not throw
      challenge.verify(SERVER_PUBLIC_KEY, { allowExpired: true });
    });

    it("throws INVALID_HOME_DOMAIN when domain doesn't match", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertThrows(
        () => challenge.verify(SERVER_PUBLIC_KEY, { homeDomain: "other.com" }),
        E.INVALID_HOME_DOMAIN
      );
    });

    it("throws INVALID_WEB_AUTH_DOMAIN when domain doesn't match", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertThrows(
        () =>
          challenge.verify(SERVER_PUBLIC_KEY, { webAuthDomain: "other.com" }),
        E.INVALID_WEB_AUTH_DOMAIN
      );
    });

    it("verifies with custom now time", () => {
      const xdr = createValidChallenge({ timeout: 900 });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Use a time in the future that's still valid
      const futureTime = new Date(Date.now() + 60000); // 1 minute from now

      // Should not throw
      challenge.verify(SERVER_PUBLIC_KEY, { now: futureTime });
    });
  });

  describe("individual verification methods", () => {
    it("verifyTimeBounds passes for valid challenge", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Should not throw
      challenge.verifyTimeBounds();
    });

    it("verifyTimeBounds throws for expired challenge", () => {
      const xdr = createValidChallenge({ timeout: -100 });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertThrows(() => challenge.verifyTimeBounds(), E.CHALLENGE_EXPIRED);
    });

    it("verifyTimeBounds allows expired when allowExpired is true", () => {
      const xdr = createValidChallenge({ timeout: -100 });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Should not throw
      challenge.verifyTimeBounds({ allowExpired: true });
    });

    it("verifyServerSignature passes for valid signature", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Should not throw
      challenge.verifyServerSignature(SERVER_PUBLIC_KEY);
    });

    it("verifyServerSignature throws for invalid signature", () => {
      const xdr = createValidChallenge({ skipServerSignature: true });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertThrows(
        () => challenge.verifyServerSignature(SERVER_PUBLIC_KEY),
        E.INVALID_SERVER_SIGNATURE
      );
    });

    it("verifyHomeDomain passes for matching domain", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Should not throw
      challenge.verifyHomeDomain(HOME_DOMAIN);
    });

    it("verifyHomeDomain throws for mismatched domain", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertThrows(
        () => challenge.verifyHomeDomain("wrong.domain.com"),
        E.INVALID_HOME_DOMAIN
      );
    });

    it("verifyWebAuthDomain passes for matching domain", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Should not throw
      challenge.verifyWebAuthDomain(SERVER_PUBLIC_KEY, WEB_AUTH_DOMAIN);
    });

    it("verifyWebAuthDomain throws for mismatched domain", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertThrows(
        () =>
          challenge.verifyWebAuthDomain(SERVER_PUBLIC_KEY, "wrong.auth.com"),
        E.INVALID_WEB_AUTH_DOMAIN
      );
    });

    it("verifyOperationSources passes for valid sources", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Should not throw
      challenge.verifyOperationSources(SERVER_PUBLIC_KEY);
    });
  });

  describe("isValid", () => {
    it("returns true for valid challenge", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertEquals(challenge.isValid(SERVER_PUBLIC_KEY), true);
    });

    it("returns false for invalid challenge", () => {
      const xdr = createValidChallenge({ skipServerSignature: true });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertEquals(challenge.isValid(SERVER_PUBLIC_KEY), false);
    });
  });

  describe("sign", () => {
    it("signs the challenge transaction", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      const initialSignatureCount = challenge.signatures.length;
      challenge.sign(CLIENT_KEYPAIR);

      assertEquals(challenge.signatures.length, initialSignatureCount + 1);
    });

    it("allows chaining sign calls", () => {
      const xdr = createValidChallenge({
        clientDomain: CLIENT_DOMAIN,
        clientDomainAccount: CLIENT_DOMAIN_PUBLIC_KEY,
      });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      challenge.sign(CLIENT_KEYPAIR).sign(CLIENT_DOMAIN_KEYPAIR);

      assertEquals(challenge.signatures.length, 3); // Server + Client + ClientDomain
    });

    it("signs with a Signer from colibri core", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Create a mock Signer that wraps a Keypair
      const mockSigner: Signer = {
        publicKey: () => CLIENT_KEYPAIR.publicKey() as `G${string}`,
        sign: (data: Buffer) => CLIENT_KEYPAIR.sign(data),
        signTransaction: () => {
          throw new Error("Not implemented");
        },
        signSorobanAuthEntry: () => {
          throw new Error("Not implemented");
        },
        signsFor: (target: string) => target === CLIENT_KEYPAIR.publicKey(),
      };

      const initialSignatureCount = challenge.signatures.length;
      challenge.sign(mockSigner);

      assertEquals(challenge.signatures.length, initialSignatureCount + 1);

      // Verify the signature is valid
      const txHash = challenge.transaction.hash();
      const lastSig =
        challenge.transaction.signatures[
          challenge.transaction.signatures.length - 1
        ];
      const isValid = CLIENT_KEYPAIR.verify(txHash, lastSig.signature());
      assertEquals(isValid, true);
    });
  });

  describe("toXDR", () => {
    it("exports the transaction to XDR", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      const exportedXdr = challenge.toXDR();

      // Should be able to parse it back
      const reparsed = SEP10Challenge.fromXDR(exportedXdr, NETWORK_PASSPHRASE);
      assertEquals(reparsed.clientAccount, CLIENT_PUBLIC_KEY);
    });

    it("includes signatures in exported XDR", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      challenge.sign(CLIENT_KEYPAIR);
      const exportedXdr = challenge.toXDR();

      const reparsed = SEP10Challenge.fromXDR(exportedXdr, NETWORK_PASSPHRASE);
      assertEquals(reparsed.signatures.length, 2);
    });
  });

  describe("toJSON", () => {
    it("returns a JSON-serializable object", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      const json = challenge.toJSON();

      assertEquals(json.serverAccount, SERVER_PUBLIC_KEY);
      assertEquals(json.clientAccount, CLIENT_PUBLIC_KEY);
      assertEquals(json.homeDomain, HOME_DOMAIN);
      assertEquals(json.webAuthDomain, WEB_AUTH_DOMAIN);
      assertEquals(typeof json.timeBounds, "object");
      assertEquals(typeof json.isExpired, "boolean");
      assertEquals(typeof json.signatureCount, "number");
    });
  });

  describe("getters", () => {
    it("returns correct isExpired for valid challenge", () => {
      const xdr = createValidChallenge({ timeout: 900 });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertEquals(challenge.isExpired, false);
    });

    it("returns correct isExpired for expired challenge", () => {
      const xdr = createValidChallenge({ timeout: -100 });
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertEquals(challenge.isExpired, true);
    });

    it("returns transaction object", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertInstanceOf(challenge.transaction, Object);
      assertEquals(challenge.transaction.source, SERVER_PUBLIC_KEY);
    });

    it("returns all operations", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      assertEquals(challenge.operations.length, 2); // auth + web_auth_domain
      assertEquals(challenge.operations[0].key, `${HOME_DOMAIN} auth`);
      assertEquals(challenge.operations[1].key, "web_auth_domain");
    });

    it("returns defensive copy of nonce (immutable)", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      const nonce1 = challenge.nonce;
      const nonce2 = challenge.nonce;

      // Should be different Buffer instances
      assertNotStrictEquals(nonce1, nonce2);
      // But have the same content
      assertEquals(nonce1.toString("base64"), nonce2.toString("base64"));

      // Modifying the returned nonce should not affect the internal state
      nonce1[0] = 0xff;
      assertNotStrictEquals(nonce1[0], challenge.nonce[0]);
    });

    it("returns defensive copy of timeBounds (immutable)", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      const tb1 = challenge.timeBounds;
      const tb2 = challenge.timeBounds;

      // Should be different object instances
      assertNotStrictEquals(tb1, tb2);
      assertNotStrictEquals(tb1.minTime, tb2.minTime);
      assertNotStrictEquals(tb1.maxTime, tb2.maxTime);

      // But have the same values
      assertEquals(tb1.minTime.getTime(), tb2.minTime.getTime());
      assertEquals(tb1.maxTime.getTime(), tb2.maxTime.getTime());
    });

    it("returns defensive copy of operations (immutable)", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      const ops1 = challenge.operations;
      const ops2 = challenge.operations;

      // Should be different array instances
      assertNotStrictEquals(ops1, ops2);
      // And different operation objects
      assertNotStrictEquals(ops1[0], ops2[0]);
      // And different Buffer instances for values
      assertNotStrictEquals(ops1[0].value, ops2[0].value);

      // But have the same content
      assertEquals(ops1[0].key, ops2[0].key);
      assertEquals(
        ops1[0].value.toString("base64"),
        ops2[0].value.toString("base64")
      );
    });

    it("returns defensive copy of signatures (immutable)", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      const sigs1 = challenge.signatures;
      const sigs2 = challenge.signatures;

      // Should be different array instances
      assertNotStrictEquals(sigs1, sigs2);

      // The returned array is readonly, protecting internal state
      // Verify both have the same length
      assertEquals(sigs1.length, sigs2.length);
    });
  });

  describe("edge cases", () => {
    it("throws MISSING_TIME_BOUNDS for transaction without timebounds", () => {
      // Create a transaction that we can manipulate
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .build();

      // Manually remove timebounds for testing
      (transaction as any)._timeBounds = undefined;

      assertThrows(
        () => SEP10Challenge.fromTransaction(transaction, NETWORK_PASSPHRASE),
        E.MISSING_TIME_BOUNDS
      );
    });

    it("throws INVALID_MEMO_TYPE for non-id memo", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addMemo(Memo.text("invalid"))
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .build();

      assertThrows(
        () => SEP10Challenge.fromTransaction(transaction, NETWORK_PASSPHRASE),
        E.INVALID_MEMO_TYPE
      );
    });

    it("throws MUXED_ACCOUNT_WITH_MEMO when parsing muxed client with memo", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      // Create a muxed account string
      const muxedAccount =
        "MAAAAAAAAAAAAAB7BQ2L7E5NBWMXDUCMZSIPOBKRDSBYVLMXGSSKF6YNPIB7Y77ITLVL6";

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addMemo(Memo.id("12345"))
        .addOperation(
          Operation.manageData({
            source: muxedAccount,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .build();

      assertThrows(
        () => SEP10Challenge.fromTransaction(transaction, NETWORK_PASSPHRASE),
        E.MUXED_ACCOUNT_WITH_MEMO
      );
    });

    it("addSignature adds a signature to the transaction", () => {
      const xdr = createValidChallenge();
      const challenge = SEP10Challenge.fromXDR(xdr, NETWORK_PASSPHRASE);

      // Get initial signature count
      const initialCount = challenge.signatures.length;

      // Create a new signature
      const signature = CLIENT_KEYPAIR.signDecorated(
        challenge.transaction.hash()
      );

      challenge.addSignature(signature);

      assertEquals(challenge.signatures.length, initialCount + 1);
    });

    it("handles operations with missing source (falls back to transaction source)", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      // The first op MUST have a source, but subsequent ops can use transaction source
      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .addOperation(
          Operation.manageData({
            // No source - will fall back to transaction source
            name: "web_auth_domain",
            value: WEB_AUTH_DOMAIN,
          })
        )
        .build();

      transaction.sign(SERVER_KEYPAIR);

      const challenge = SEP10Challenge.fromTransaction(
        transaction,
        NETWORK_PASSPHRASE
      );

      // The web_auth_domain op should have fallen back to server account
      assertEquals(challenge.operations[1].sourceAccount, SERVER_PUBLIC_KEY);
    });

    it("throws INVALID_WEB_AUTH_DOMAIN when web_auth_domain source is not server", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);
      const otherKeypair = Keypair.random();

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .addOperation(
          Operation.manageData({
            source: otherKeypair.publicKey(), // Wrong source!
            name: "web_auth_domain",
            value: WEB_AUTH_DOMAIN,
          })
        )
        .build();

      transaction.sign(SERVER_KEYPAIR);

      const challenge = SEP10Challenge.fromTransaction(
        transaction,
        NETWORK_PASSPHRASE
      );

      assertThrows(
        () =>
          challenge.verify(SERVER_PUBLIC_KEY, {
            homeDomain: HOME_DOMAIN,
            webAuthDomain: WEB_AUTH_DOMAIN,
          }),
        E.INVALID_WEB_AUTH_DOMAIN
      );
    });

    it("throws INVALID_OPERATION_SOURCE for non-server operation source", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);
      const otherKeypair = Keypair.random();

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .addOperation(
          Operation.manageData({
            source: SERVER_PUBLIC_KEY,
            name: "web_auth_domain",
            value: WEB_AUTH_DOMAIN,
          })
        )
        .addOperation(
          Operation.manageData({
            source: otherKeypair.publicKey(), // Wrong source for a custom operation!
            name: "some_other_data",
            value: "test",
          })
        )
        .build();

      transaction.sign(SERVER_KEYPAIR);

      const challenge = SEP10Challenge.fromTransaction(
        transaction,
        NETWORK_PASSPHRASE
      );

      assertThrows(
        () =>
          challenge.verify(SERVER_PUBLIC_KEY, {
            homeDomain: HOME_DOMAIN,
            webAuthDomain: WEB_AUTH_DOMAIN,
          }),
        E.INVALID_OPERATION_SOURCE
      );
    });

    it("skips client_domain operation during source validation", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);
      const clientDomainKeypair = Keypair.random();

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .addOperation(
          Operation.manageData({
            source: SERVER_PUBLIC_KEY,
            name: "web_auth_domain",
            value: WEB_AUTH_DOMAIN,
          })
        )
        .addOperation(
          Operation.manageData({
            source: clientDomainKeypair.publicKey(), // Different source is OK for client_domain
            name: "client_domain",
            value: "client.example.com",
          })
        )
        .build();

      transaction.sign(SERVER_KEYPAIR);

      const challenge = SEP10Challenge.fromTransaction(
        transaction,
        NETWORK_PASSPHRASE
      );

      // Should not throw - client_domain ops are allowed to have different source
      challenge.verify(SERVER_PUBLIC_KEY, {
        homeDomain: HOME_DOMAIN,
        webAuthDomain: WEB_AUTH_DOMAIN,
      });

      assertEquals(challenge.clientDomain, "client.example.com");
    });

    it("handles operations with empty value", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .addOperation(
          Operation.manageData({
            source: SERVER_PUBLIC_KEY,
            name: "web_auth_domain",
            value: "", // Empty value
          })
        )
        .build();

      transaction.sign(SERVER_KEYPAIR);

      const challenge = SEP10Challenge.fromTransaction(
        transaction,
        NETWORK_PASSPHRASE
      );

      // The operation should still be parsed
      assertEquals(challenge.operations.length, 2);
    });

    it("throws INVALID_NONCE for null nonce value", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: null as unknown as string, // null value
          })
        )
        .build();

      assertThrows(
        () => SEP10Challenge.fromTransaction(transaction, NETWORK_PASSPHRASE),
        E.INVALID_NONCE
      );
    });

    it("handles challenge with non-manageData operations after first op", () => {
      // This tests the defensive continue statement for non-manageData ops
      // In real scenarios, challenges shouldn't have non-manageData ops
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      // Build a valid challenge and manipulate it
      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
          })
        )
        .addOperation(
          Operation.bumpSequence({
            source: SERVER_PUBLIC_KEY,
            bumpTo: "100",
          })
        )
        .build();

      transaction.sign(SERVER_KEYPAIR);

      // Should parse without throwing, just skip the non-manageData op
      const challenge = SEP10Challenge.fromTransaction(
        transaction,
        NETWORK_PASSPHRASE
      );

      // Only the first operation should be in the parsed operations
      assertEquals(challenge.operations.length, 1);
      assertEquals(challenge.operations[0].key, `${HOME_DOMAIN} auth`);
    });

    it("handles manageData operation with undefined value (defensive fallback)", () => {
      const account = new Account(SERVER_PUBLIC_KEY, "-1");
      const now = Math.floor(Date.now() / 1000);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
        timebounds: { minTime: now, maxTime: now + 900 },
      })
        .addOperation(
          Operation.manageData({
            source: CLIENT_PUBLIC_KEY,
            name: `${HOME_DOMAIN} auth`,
            value: Buffer.from(
              crypto.getRandomValues(new Uint8Array(48))
            ).toString("base64"),
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

      // Force undefined value on second operation to test defensive || "" fallback
      (transaction.operations[1] as any).value = undefined;

      transaction.sign(SERVER_KEYPAIR);

      const challenge = SEP10Challenge.fromTransaction(
        transaction,
        NETWORK_PASSPHRASE
      );

      // Should parse and the undefined value becomes empty buffer
      assertEquals(challenge.operations.length, 2);
      assertEquals(challenge.operations[1].value.length, 0);
    });
  });
});

// =============================================================================
// Error Classes Coverage Tests
// =============================================================================

describe("Error Classes Coverage", () => {
  describe("INVALID_XDR", () => {
    it("uses cause message when provided", () => {
      const cause = new Error("Custom decode error");
      const error = new E.INVALID_XDR(cause, "badxdr");
      assertEquals(error.diagnostic?.rootCause, "Custom decode error");
    });

    it("uses default message when no cause", () => {
      const error = new E.INVALID_XDR(undefined, "badxdr");
      assertEquals(error.diagnostic?.rootCause, "Failed to decode XDR");
    });
  });

  describe("CHALLENGE_EXPIRED", () => {
    it("handles expired challenge (now > maxTime)", () => {
      const minTime = 1000;
      const maxTime = 2000;
      const now = 3000; // After maxTime
      const error = new E.CHALLENGE_EXPIRED(minTime, maxTime, now);
      assertEquals(error.message, "Challenge has expired");
      assertEquals(
        error.diagnostic?.rootCause,
        "The challenge transaction's time bounds have passed"
      );
      assertEquals(error.meta.data.expired, true);
      assertEquals(error.meta.data.notYetValid, false);
    });

    it("handles not yet valid challenge (now < minTime)", () => {
      const minTime = 2000;
      const maxTime = 3000;
      const now = 1000; // Before minTime
      const error = new E.CHALLENGE_EXPIRED(minTime, maxTime, now);
      assertEquals(error.message, "Challenge not yet valid");
      assertEquals(
        error.diagnostic?.rootCause,
        "The challenge transaction's time bounds have not started"
      );
      assertEquals(error.meta.data.expired, false);
      assertEquals(error.meta.data.notYetValid, true);
    });
  });

  describe("CLIENT_ACCOUNT_MISMATCH", () => {
    it("shows expected account when provided", () => {
      const error = new E.CLIENT_ACCOUNT_MISMATCH("GACTUAL...", "GEXPECTED...");
      assertEquals(
        error.details,
        "First operation source account 'GACTUAL...' does not match expected client account 'GEXPECTED...'."
      );
    });

    it("shows default message when expected not provided", () => {
      const error = new E.CLIENT_ACCOUNT_MISMATCH("GACTUAL...");
      assertEquals(
        error.details,
        "First operation must have a source account set to the client account, but got 'GACTUAL...'."
      );
    });
  });

  describe("INVALID_SERVER_SIGNATURE", () => {
    it("uses cause message when provided", () => {
      const cause = new Error("Signature verify failed");
      const error = new E.INVALID_SERVER_SIGNATURE("GSERVER...", cause);
      assertEquals(error.diagnostic?.rootCause, "Signature verify failed");
    });

    it("uses default message when no cause", () => {
      const error = new E.INVALID_SERVER_SIGNATURE("GSERVER...");
      assertEquals(
        error.diagnostic?.rootCause,
        "Server signature verification failed"
      );
    });
  });

  describe("INVALID_WEB_AUTH_DOMAIN", () => {
    it("handles sourceAccount mismatch", () => {
      const error = new E.INVALID_WEB_AUTH_DOMAIN({
        sourceAccount: "GWRONGACCOUNT...",
      });
      assertEquals(
        error.details,
        "web_auth_domain operation source account must be the server account, but got 'GWRONGACCOUNT...'."
      );
    });

    it("handles expected vs actual mismatch", () => {
      const error = new E.INVALID_WEB_AUTH_DOMAIN({
        expected: "auth.example.com",
        actual: "wrong.example.com",
      });
      assertEquals(
        error.details,
        "web_auth_domain 'wrong.example.com' does not match expected 'auth.example.com'."
      );
    });

    it("handles generic invalid case", () => {
      const error = new E.INVALID_WEB_AUTH_DOMAIN({});
      assertEquals(error.details, "web_auth_domain operation is invalid.");
    });
  });

  describe("INVALID_CLIENT_DOMAIN", () => {
    it("shows client domain account mismatch", () => {
      const error = new E.INVALID_CLIENT_DOMAIN({
        clientDomainAccount: "GEXPECTED...",
        sourceAccount: "GACTUAL...",
      });
      assertEquals(
        error.details,
        "client_domain operation source account 'GACTUAL...' does not match expected client domain account 'GEXPECTED...'."
      );
    });
  });

  describe("MISSING_SIGNATURE", () => {
    it("shows missing account", () => {
      const error = new E.MISSING_SIGNATURE("GMISSING...");
      assertEquals(
        error.details,
        "Challenge is missing a signature from account 'GMISSING...'."
      );
      assertEquals(error.code, E.Code.MISSING_SIGNATURE);
    });
  });
});
