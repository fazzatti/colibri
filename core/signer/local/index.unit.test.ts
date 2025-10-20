import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
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
import { LocalSigner } from "./index.ts";
import type { Ed25519PublicKey, Ed25519SecretKey } from "../../strkeys/types.ts";


describe("LocalSigner", () => {
  const TEST_SECRET = "SC3DH36U5MAMSKENSVWSCVOXKCAEWX7EEHR347PJNHMMQDXRBSZ3PRCJ" as Ed25519SecretKey;
  const TEST_PUBLIC = "GAA2CTTAU36PSQZI2QX2FZ2AVJEFSJSOYDQ4CJ35NKSRHXVBTZWYAMSZ" as Ed25519PublicKey;

  describe("fromSecret", () => {
    it("creates a signer from Ed25519 secret", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);

      assertExists(signer);
      assertEquals(signer.publicKey(), TEST_PUBLIC);
    });

    it("secret is not exposed on the instance", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      
      const keys = Object.keys(signer);
      const hasSecretProperty = keys.some(k => 
        k.toLowerCase().includes("secret") || k.toLowerCase().includes("private")
      );
      
      assert(!hasSecretProperty, "Secret should not be exposed as property");
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
        Error,
        "Signer destroyed"
      );
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
        assertEquals((e as Error).message, "Signer destroyed");
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
        Error,
        "Signer destroyed"
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

