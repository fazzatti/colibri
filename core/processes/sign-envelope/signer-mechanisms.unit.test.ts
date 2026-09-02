import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { Buffer } from "node:buffer";
import {
  Account,
  FeeBumpTransaction,
  Keypair,
  Networks,
  Operation,
  SignerKey as StellarSignerKey,
  StrKey as StellarStrKey,
  type Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import { signEnvelope } from "@/processes/sign-envelope/index.ts";
import * as E from "@/processes/sign-envelope/error.ts";
import { HashXSigner } from "@/signer/hash-x/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { PreAuthorizedTransactionSigner } from "@/signer/pre-authorized-transaction/index.ts";
import { Ed25519SignedPayloadSigner } from "@/signer/signed-payload/index.ts";
import { OperationThreshold, type Signer } from "@/signer/types.ts";
import type {
  Ed25519PublicKey,
  Ed25519SecretKey,
  PreAuthTx,
} from "@/strkeys/types.ts";

describe("signEnvelope signer mechanisms", () => {
  const networkPassphrase = Networks.TESTNET;
  const keypairs = [
    Keypair.fromSecret(
      "SAO45YQLDI4LIEPP2HXYVX72XBKEN4OBWYKR3P6AOS7EMOLJCJX5IF5A",
    ),
    Keypair.fromSecret(
      "SA2WW3DO6AVJQO5V4MU64DSDL34FRXVIQXIUMKS7JMAENCCI3ORMQVLA",
    ),
  ];
  const account = (index: number) =>
    keypairs[index].publicKey() as Ed25519PublicKey;
  const localSigner = (index: number) =>
    LocalSigner.fromSecret(keypairs[index].secret() as Ed25519SecretKey);
  const requirement = (address: Ed25519PublicKey) => ({
    address,
    thresholdLevel: OperationThreshold.low,
  });
  const buildTransaction = (
    source: Ed25519PublicKey,
    extraSigners: string[] = [],
    sequence = "100",
  ): Transaction => {
    const builder = new TransactionBuilder(new Account(source, sequence), {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(Operation.setOptions({}));
    if (extraSigners.length) builder.setExtraSigners(extraSigners);
    return builder.setTimeout(0).build();
  };

  describe("selection", () => {
    it("selects a Hash-X signer for an explicitly targeted account", async () => {
      const transaction = buildTransaction(account(0));
      const signer = HashXSigner.fromPreimage(
        new Uint8Array([1, 2, 3]),
      );
      signer.addTarget(account(0));

      const output = await signEnvelope({
        transaction,
        signatureRequirements: [requirement(account(0))],
        signers: [signer],
      });

      assertEquals(output.signatures.length, 1);
      assertEquals(
        Buffer.from(output.signatures[0].signature.toBytes()).toString("hex"),
        "010203",
      );
    });

    it("matches exact extra signers without requiring account targets", async () => {
      const sourceSigner = localSigner(0);
      const extraSigner = HashXSigner.fromPreimage(
        new Uint8Array([4, 5, 6]),
      );
      const transaction = buildTransaction(
        sourceSigner.publicKey(),
        [extraSigner.signerKey()],
      );

      const output = await signEnvelope({
        transaction,
        signatureRequirements: [requirement(sourceSigner.publicKey())],
        signers: [sourceSigner, extraSigner],
      });

      assertEquals(output.signatures.length, 2);
    });

    it("supports signed-payload keys as exact extra signers", async () => {
      const sourceSigner = localSigner(0);
      const payloadSigner = Ed25519SignedPayloadSigner.fromPayload({
        signer: localSigner(1),
        payload: new Uint8Array([7, 8, 9]),
      });
      const transaction = buildTransaction(
        sourceSigner.publicKey(),
        [payloadSigner.signerKey()],
      );

      const output = await signEnvelope({
        transaction,
        signatureRequirements: [requirement(sourceSigner.publicKey())],
        signers: [sourceSigner, payloadSigner],
      });

      assertEquals(output.signatures.length, 2);
    });

    it("deduplicates a signer selected by account and exact key", async () => {
      const signer = localSigner(0);
      const transaction = buildTransaction(
        signer.publicKey(),
        [signer.signerKey()],
      );

      const output = await signEnvelope({
        transaction,
        signatureRequirements: [requirement(signer.publicKey())],
        signers: [signer],
      });

      assertEquals(output.signatures.length, 1);
    });

    it("accepts an exact pre-authorized transaction without a signature", async () => {
      const transaction = buildTransaction(account(0));
      const signer = PreAuthorizedTransactionSigner.fromTransaction(
        transaction,
      );
      signer.addTarget(account(0));

      const output = await signEnvelope({
        transaction,
        signatureRequirements: [requirement(account(0))],
        signers: [signer],
      });

      assertEquals(output.signatures.length, 0);
      assertEquals(output.toXdr(), transaction.toXdr());
    });

    it("checks pre-authorization after another signer mutates the envelope", async () => {
      const transaction = buildTransaction(account(0));
      const envelopeSigner = localSigner(0);
      const preAuthorized = PreAuthorizedTransactionSigner.fromTransaction(
        transaction,
      );
      preAuthorized.addTarget(account(1));

      const output = await signEnvelope({
        transaction,
        signatureRequirements: [
          requirement(account(0)),
          requirement(account(1)),
        ],
        signers: [envelopeSigner, preAuthorized],
      });

      assertEquals(output.signatures.length, 1);
    });

    it("supports pre-authorized fee-bump transactions", async () => {
      const inner = buildTransaction(account(1));
      const feeBump = TransactionBuilder.buildFeeBumpTransaction(
        account(0),
        "100",
        inner,
        networkPassphrase,
      );
      const signer = PreAuthorizedTransactionSigner.fromTransaction(feeBump);
      signer.addTarget(account(0));

      const output = await signEnvelope({
        transaction: feeBump,
        signatureRequirements: [requirement(account(0))],
        signers: [signer],
      });

      assert(output instanceof FeeBumpTransaction);
      assertEquals(output.signatures.length, 0);
    });
  });

  describe("deterministic errors", () => {
    it("rejects signer identity lookup failures", async () => {
      const transaction = buildTransaction(account(0));
      const signer = {
        signerKey: () => {
          throw new Error("identity failed");
        },
        signsFor: () => true,
        signTransaction: () => transaction.toXdr(),
      } as Signer;

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(account(0))],
            signers: [signer],
          }),
        E.FAILED_TO_GET_SIGNER_KEY,
      );
    });

    it("rejects signer target lookup failures", async () => {
      const transaction = buildTransaction(account(0));
      const signer = {
        signerKey: () => account(0),
        signsFor: () => {
          throw new Error("target failed");
        },
        signTransaction: () => transaction.toXdr(),
      } as Signer;

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(account(0))],
            signers: [signer],
          }),
        E.FAILED_TO_CHECK_SIGNER_TARGET,
      );
    });

    it("rejects duplicate matching signer identities", async () => {
      const transaction = buildTransaction(account(0));
      const first = localSigner(0);
      const second = localSigner(0);

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(account(0))],
            signers: [first, second],
          }),
        E.DUPLICATE_SIGNER_KEY,
      );
    });

    it("rejects multiple distinct signer keys targeting one account", async () => {
      const transaction = buildTransaction(account(0));
      const first = localSigner(0);
      const second = localSigner(1);
      second.addTarget(account(0));

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(account(0))],
            signers: [first, second],
          }),
        E.AMBIGUOUS_ACCOUNT_SIGNERS,
      );
    });

    it("rejects a missing exact extra signer", async () => {
      const sourceSigner = localSigner(0);
      const missing = HashXSigner.fromPreimage(new Uint8Array([1]));
      const transaction = buildTransaction(
        sourceSigner.publicKey(),
        [missing.signerKey()],
      );

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(sourceSigner.publicKey())],
            signers: [sourceSigner],
          }),
        E.EXTRA_SIGNER_NOT_FOUND,
      );
    });

    it("rejects duplicate exact extra signer identities", async () => {
      const sourceSigner = localSigner(0);
      const first = HashXSigner.fromPreimage(new Uint8Array([1]));
      const second = HashXSigner.fromPreimage(new Uint8Array([1]));
      const transaction = buildTransaction(
        sourceSigner.publicKey(),
        [first.signerKey()],
      );

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(sourceSigner.publicKey())],
            signers: [sourceSigner, first, second],
          }),
        E.DUPLICATE_SIGNER_KEY,
      );
    });

    it("rejects pre-authorized transaction keys in extraSigners", async () => {
      const sourceSigner = localSigner(0);
      const preAuthKey = StellarStrKey.encodePreAuthTx(
        Buffer.alloc(32),
      ) as PreAuthTx;
      const transaction = buildTransaction(
        sourceSigner.publicKey(),
        [preAuthKey],
      );

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(sourceSigner.publicKey())],
            signers: [sourceSigner],
          }),
        E.UNSUPPORTED_PRE_AUTH_EXTRA_SIGNER,
      );
    });

    it("wraps failures while decoding transaction extra signers", async () => {
      const sourceSigner = localSigner(0);
      const extraSigner = HashXSigner.fromPreimage(new Uint8Array([1]));
      const transaction = buildTransaction(
        sourceSigner.publicKey(),
        [extraSigner.signerKey()],
      );
      using _stub = stub(
        StellarSignerKey,
        "encodeSignerKey",
        () => {
          throw new Error("decode failed");
        },
      );

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(sourceSigner.publicKey())],
            signers: [sourceSigner, extraSigner],
          }),
        E.FAILED_TO_READ_EXTRA_SIGNERS,
      );
    });

    it("rejects a pre-authorized signer for another transaction", async () => {
      const transaction = buildTransaction(account(0));
      const signer = PreAuthorizedTransactionSigner.fromTransaction(
        buildTransaction(account(1)),
      );
      signer.addTarget(account(0));

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(account(0))],
            signers: [signer],
          }),
        E.PRE_AUTH_TRANSACTION_MISMATCH,
      );
    });

    it("wraps pre-authorized transaction verification failures", async () => {
      const transaction = buildTransaction(account(0));
      const signer = {
        signerKey: () =>
          StellarStrKey.encodePreAuthTx(Buffer.alloc(32)) as PreAuthTx,
        signsFor: () => true,
        authorizesTransaction: () => {
          throw new Error("verification failed");
        },
      } as Signer;

      await assertRejects(
        () =>
          signEnvelope({
            transaction,
            signatureRequirements: [requirement(account(0))],
            signers: [signer],
          }),
        E.FAILED_TO_CHECK_PRE_AUTH_TRANSACTION,
      );
    });
  });
});
