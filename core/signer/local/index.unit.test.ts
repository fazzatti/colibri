import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { Buffer } from "buffer";
import { describe, it } from "@std/testing/bdd";
import {
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  Asset,
  xdr,
  Account,
  Contract,
} from "stellar-sdk";
import { LocalSigner } from "@/signer/local/index.ts";
import type {
  ContractId,
  Ed25519PublicKey,
  Ed25519SecretKey,
} from "@/strkeys/types.ts";
import * as E from "@/signer/local/error.ts";

describe("LocalSigner", () => {
  const TEST_SECRET =
    "SC3DH36U5MAMSKENSVWSCVOXKCAEWX7EEHR347PJNHMMQDXRBSZ3PRCJ" as Ed25519SecretKey;
  const TEST_PUBLIC =
    "GAA2CTTAU36PSQZI2QX2FZ2AVJEFSJSOYDQ4CJ35NKSRHXVBTZWYAMSZ" as Ed25519PublicKey;
  const TEST_CONTRACT_ID =
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId;

  describe("fromSecret", () => {
    it("creates a signer from Ed25519 secret", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);

      assertExists(signer);
      assertEquals(signer.publicKey(), TEST_PUBLIC);
    });

    it("secretKey method exists but does not expose secret as plain property", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);

      // secretKey is a method, not a direct property
      assert(typeof signer.secretKey === "function");

      // The actual secret value should not be directly accessible as a property
      const ownProps = Object.getOwnPropertyNames(signer);
      const hasSecretValue = ownProps.some(
        (k) => {
          const descriptor = Object.getOwnPropertyDescriptor(signer, k);
          return descriptor?.value === TEST_SECRET;
        }
      );

      assert(!hasSecretValue, "Secret value should not be stored directly on instance");
    });

    it("creates a signer with hideSecret = false by default", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      assertEquals(signer.secretKey(), TEST_SECRET);
    });

    it("creates a signer with hideSecret = true", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET, true);
      assertThrows(
        () => signer.secretKey(),
        E.SECRET_NOT_ACCESSIBLE,
        "Secret key is not accessible"
      );
    });
  });

  describe("generateRandom", () => {
    it("creates a signer with random keypair", () => {
      const signer1 = LocalSigner.generateRandom();
      const signer2 = LocalSigner.generateRandom();

      assertExists(signer1.publicKey());
      assertExists(signer2.publicKey());
      assertNotEquals(signer1.publicKey(), signer2.publicKey());
    });

    it("creates a signer with accessible secret by default", () => {
      const signer = LocalSigner.generateRandom();
      assertExists(signer.secretKey());
    });

    it("creates a signer with hidden secret when hideSecret = true", () => {
      const signer = LocalSigner.generateRandom(true);
      assertThrows(
        () => signer.secretKey(),
        E.SECRET_NOT_ACCESSIBLE,
        "Secret key is not accessible"
      );
    });
  });

  describe("secretKey", () => {
    it("returns the secret key when not hidden", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      assertEquals(signer.secretKey(), TEST_SECRET);
    });

    it("throws when secret is hidden", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET, true);
      assertThrows(
        () => signer.secretKey(),
        E.SECRET_NOT_ACCESSIBLE,
        "Secret key is not accessible"
      );
    });

    it("throws after destroy even when secret was accessible", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      signer.destroy();
      assertThrows(() => signer.secretKey(), E.SIGNER_DESTROYED);
    });
  });

  describe("publicKey", () => {
    it("returns the public key", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      assertEquals(signer.publicKey(), TEST_PUBLIC);
    });

    it("works after multiple calls", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const pk1 = signer.publicKey();
      const pk2 = signer.publicKey();
      assertEquals(pk1, pk2);
    });
  });

  describe("signsFor", () => {
    it("returns true for signer's own public key by default", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      assert(signer.signsFor(TEST_PUBLIC));
    });

    it("returns false for unknown public key", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const otherKey = Keypair.random().publicKey() as Ed25519PublicKey;
      assert(!signer.signsFor(otherKey));
    });

    it("returns true for added target public key", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const otherKey = Keypair.random().publicKey() as Ed25519PublicKey;
      signer.addTarget(otherKey);
      assert(signer.signsFor(otherKey));
    });

    it("returns true for added contract ID", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      signer.addTarget(TEST_CONTRACT_ID);
      assert(signer.signsFor(TEST_CONTRACT_ID));
    });

    it("returns false for removed target", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const otherKey = Keypair.random().publicKey() as Ed25519PublicKey;
      signer.addTarget(otherKey);
      assert(signer.signsFor(otherKey));
      signer.removeTarget(otherKey);
      assert(!signer.signsFor(otherKey));
    });
  });

  describe("addTarget", () => {
    it("adds a public key target", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const otherKey = Keypair.random().publicKey() as Ed25519PublicKey;
      signer.addTarget(otherKey);
      assert(signer.signsFor(otherKey));
    });

    it("adds a contract ID target", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      signer.addTarget(TEST_CONTRACT_ID);
      assert(signer.signsFor(TEST_CONTRACT_ID));
    });

    it("adding the same target twice does not duplicate", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const otherKey = Keypair.random().publicKey() as Ed25519PublicKey;
      signer.addTarget(otherKey);
      signer.addTarget(otherKey);
      assertEquals(signer.getTargets().filter((t) => t === otherKey).length, 1);
    });
  });

  describe("getTargets", () => {
    it("returns the signer's own public key by default", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const targets = signer.getTargets();
      assertEquals(targets.length, 1);
      assertEquals(targets[0], TEST_PUBLIC);
    });

    it("returns all added targets", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const otherKey = Keypair.random().publicKey() as Ed25519PublicKey;
      signer.addTarget(otherKey);
      signer.addTarget(TEST_CONTRACT_ID);

      const targets = signer.getTargets();
      assertEquals(targets.length, 3);
      assert(targets.includes(TEST_PUBLIC));
      assert(targets.includes(otherKey));
      assert(targets.includes(TEST_CONTRACT_ID));
    });
  });

  describe("removeTarget", () => {
    it("removes an added target", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const otherKey = Keypair.random().publicKey() as Ed25519PublicKey;
      signer.addTarget(otherKey);
      assert(signer.signsFor(otherKey));

      signer.removeTarget(otherKey);
      assert(!signer.signsFor(otherKey));
    });

    it("throws when trying to remove signer's own public key", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      assertThrows(
        () => signer.removeTarget(TEST_PUBLIC),
        E.CANNOT_REMOVE_MASTER_TARGET
      );
    });

    it("removing non-existent target is a no-op", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const otherKey = Keypair.random().publicKey() as Ed25519PublicKey;
      // Should not throw
      signer.removeTarget(otherKey);
      assert(!signer.signsFor(otherKey));
    });
  });

  describe("sign", () => {
    it("signs a transaction and returns XDR", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const sourceKp = Keypair.fromSecret(TEST_SECRET);
      
      const account = new Account(sourceKp.publicKey(), "0");
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "10",
          })
        )
        .setTimeout(30)
        .build();

      const xdr = signer.signTransaction(tx);

      assertExists(xdr);
      assert(typeof xdr === "string");
      assert(xdr.length > 0);
      
      // Verify signature was added
      assertEquals(tx.signatures.length, 1);
    });

    it("throws after destroy", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      signer.destroy();

      const account = new Account(TEST_PUBLIC, "0");
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: "10",
          })
        )
        .setTimeout(30)
        .build();

      assertThrows(
        () => signer.signTransaction(tx),
        E.SIGNER_DESTROYED
      );
    });
  });

  describe("sign (raw data)", () => {
    it("signs raw data and returns a Buffer", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const data = Buffer.from("test message to sign");

      const signature = signer.sign(data);

      assertExists(signature);
      assert(Buffer.isBuffer(signature));
      assertEquals(signature.length, 64); // Ed25519 signatures are 64 bytes
    });

    it("produces valid signature that can be verified", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const data = Buffer.from("test message to sign");

      const signature = signer.sign(data);

      // Verify using stellar-sdk Keypair
      const keypair = Keypair.fromPublicKey(TEST_PUBLIC);
      assert(keypair.verify(data, signature));
    });

    it("produces different signatures for different data", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const data1 = Buffer.from("message one");
      const data2 = Buffer.from("message two");

      const sig1 = signer.sign(data1);
      const sig2 = signer.sign(data2);

      assertNotEquals(sig1.toString("hex"), sig2.toString("hex"));
    });

    it("throws after destroy", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      signer.destroy();

      const data = Buffer.from("test message");

      assertThrows(
        () => signer.sign(data),
        E.SIGNER_DESTROYED
      );
    });
  });

  describe("verifySignature", () => {
    it("returns true for valid signature", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const data = Buffer.from("test message to verify");

      const signature = signer.sign(data);
      const isValid = signer.verifySignature(data, signature);

      assert(isValid);
    });

    it("returns false for invalid signature", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const data = Buffer.from("test message");
      const invalidSignature = Buffer.alloc(64, 0); // All zeros is invalid

      const isValid = signer.verifySignature(data, invalidSignature);

      assert(!isValid);
    });

    it("returns false for signature of different data", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const data1 = Buffer.from("original message");
      const data2 = Buffer.from("different message");

      const signature = signer.sign(data1);
      const isValid = signer.verifySignature(data2, signature);

      assert(!isValid);
    });

    it("returns false for signature from different key", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const otherSigner = LocalSigner.generateRandom();
      const data = Buffer.from("test message");

      const otherSignature = otherSigner.sign(data);
      const isValid = signer.verifySignature(data, otherSignature);

      assert(!isValid);
    });

    it("works after destroy (uses only public key)", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const data = Buffer.from("test message");
      const signature = signer.sign(data);

      signer.destroy();

      // verifySignature should still work as it only needs the public key
      const isValid = signer.verifySignature(data, signature);
      assert(isValid);
    });
  });

  describe("signSorobanAuthEntry", () => {
    it("signs a Soroban auth entry", async () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      
      // Create a minimal auth entry for testing
      const credentials = xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: xdr.ScAddress.scAddressTypeAccount(
            xdr.PublicKey.publicKeyTypeEd25519(
              Keypair.fromPublicKey(TEST_PUBLIC).rawPublicKey()
            )
          ),
          nonce: xdr.Int64.fromString("0"),
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVec([]),
        })
      );

      const entry = new xdr.SorobanAuthorizationEntry({
        credentials,
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress:new Contract("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM").address().toScAddress(),
              functionName: "test",
              args: [],
            })
          ),
          subInvocations: [],
        }),
      });

      const validUntil = 1000000;
      const signedEntry = await signer.signSorobanAuthEntry(
        entry,
        validUntil,
        Networks.TESTNET
      );

      assertExists(signedEntry);
      assert(signedEntry instanceof xdr.SorobanAuthorizationEntry);
    });

    it("throws after destroy", async () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      signer.destroy();

      const entry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
        rootInvocation: new xdr.SorobanAuthorizedInvocation({
          function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: new Contract("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM").address().toScAddress(),
              functionName: "test",
              args: [],
            })
          ),
          subInvocations: [],
        }),
      });

      try {
        await signer.signSorobanAuthEntry(entry, 1000000, Networks.TESTNET);
        assert(false, "Should have thrown");
      } catch (e) {
        assert(e instanceof E.SIGNER_DESTROYED);
      }
    });
  });

  describe("destroy", () => {
    it("invalidates the signer", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      signer.destroy();

      // publicKey should still work (it's just a string)
      assertEquals(signer.publicKey(), TEST_PUBLIC);

      // but sign should fail
      const account = new Account(TEST_PUBLIC, "0");
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .setTimeout(30)
        .build();

      assertThrows(() => signer.signTransaction(tx));
    });

    it("is idempotent", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      signer.destroy();
      signer.destroy(); // should not throw
      signer.destroy(); // should not throw
    });
  });

  describe("Symbol.dispose", () => {
 it("calls destroy when using 'using' keyword", () => {
      let signer: LocalSigner;
      
      {
        using tempSigner = LocalSigner.fromSecret(TEST_SECRET);
        signer = tempSigner;
        assertEquals(signer.publicKey(), TEST_PUBLIC);
      }
      
      // After scope, signer should be destroyed
      const account = new Account(TEST_PUBLIC, "0");
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .setTimeout(30)
        .build();

      assertThrows(
        () => signer.signTransaction(tx),
        E.SIGNER_DESTROYED
      );
    });
  });

  describe("toJSON", () => {
    it("returns only the public key", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const json = signer.toJSON();

      assertEquals(json, { publicKey: TEST_PUBLIC });
      assert(!("sign" in json));
      assert(!("destroy" in json));
    });

    it("does not leak secret in JSON.stringify", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const stringified = JSON.stringify(signer);

      assert(!stringified.includes("secret"));
      assert(!stringified.includes("SBFZQU4X")); // start of secret
      assert(stringified.includes(TEST_PUBLIC));
      assertEquals(stringified, `{"publicKey":"${TEST_PUBLIC}"}`);
    });
  });
});

