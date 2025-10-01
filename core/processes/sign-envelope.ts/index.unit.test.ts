// deno-lint-ignore-file require-await
import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it, beforeEach } from "@std/testing/bdd";
import {
  Account,
  FeeBumpTransaction,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
} from "stellar-sdk";

import { SignEnvelope } from "./index.ts";
import * as E from "./error.ts";
import { TestNet } from "../../network/index.ts";
import { OperationThreshold } from "../../common/types.ts";
import type { Ed25519Signer } from "../../common/types.ts";
import { Ed25519PublicKey } from "@colibri/core";

describe("SignEnvelope", () => {
  const { networkPassphrase } = TestNet();

  // Reuse deterministic test keypairs
  const KPS = [
    Keypair.fromSecret(
      "SAO45YQLDI4LIEPP2HXYVX72XBKEN4OBWYKR3P6AOS7EMOLJCJX5IF5A"
    ),
    Keypair.fromSecret(
      "SA2WW3DO6AVJQO5V4MU64DSDL34FRXVIQXIUMKS7JMAENCCI3ORMQVLA"
    ),
    Keypair.fromSecret(
      "SCHH7OAC6MC4NF3TG2JML56WJT5U7ZE355USOKGXZCQ2FCJZEX62OEKR"
    ),
  ];

  const buildTx = (source: string): Transaction => {
    const sourceAcc = new Account(source, "100");
    const txb = new TransactionBuilder(sourceAcc, {
      fee: "100",
      networkPassphrase,
    });
    txb.addOperation(Operation.setOptions({}));
    txb.setTimeout(0);
    return txb.build();
  };

  const buildFeeBump = (
    feeSource: string,
    inner: Transaction
  ): FeeBumpTransaction => {
    return TransactionBuilder.buildFeeBumpTransaction(
      feeSource,
      "100",
      inner,
      networkPassphrase
    );
  };

  type MockSigner = Ed25519Signer & {
    calls: number;
    lastType?: "tx" | "feeBump";
  };

  const createSigner = (kp: Keypair): MockSigner => {
    return {
      publicKey: kp.publicKey() as Ed25519PublicKey,
      calls: 0,
      async sign(tx: Transaction | FeeBumpTransaction): Promise<string> {
        this.calls++;
        if (tx instanceof FeeBumpTransaction) {
          this.lastType = "feeBump";
          tx.sign(kp);
          return tx.toXDR();
        } else {
          this.lastType = "tx";
          tx.sign(kp);
          return tx.toXDR();
        }
      },
    };
  };

  const createFailingSigner = (
    publicKey: string,
    mode: "throw" | "invalidXDR"
  ): MockSigner => {
    return {
      publicKey: publicKey as Ed25519PublicKey,
      calls: 0,
      async sign(): Promise<string> {
        this.calls++;
        if (mode === "throw") {
          throw new Error("boom");
        }
        return "invalidXDR";
      },
    };
  };

  beforeEach(() => {});

  describe("Construction", () => {
    it("creates process with proper name", () => {
      assertEquals(SignEnvelope.name, "SignEnvelope");
    });
  });

  describe("Success", () => {
    it("signs a Transaction with one requirement and one signer", async () => {
      const tx = buildTx(KPS[1].publicKey());
      const signer = createSigner(KPS[0]);

      const out = await SignEnvelope.run({
        transaction: tx,
        signatureRequirements: [
          { signer: signer.publicKey, thresholdLevel: OperationThreshold.low },
        ],
        signers: [signer],
      });

      assert(out instanceof Transaction);
      assertEquals(out.signatures.length, 1);
      assertEquals(signer.calls, 1);
    });

    it("signs a Transaction when multiple signers are provided but only one matches", async () => {
      const tx = buildTx(KPS[1].publicKey());
      const signer0 = createSigner(KPS[0]);
      const signer1 = createSigner(KPS[1]);
      const signer2 = createSigner(KPS[2]);

      const out = await SignEnvelope.run({
        transaction: tx,
        signatureRequirements: [
          { signer: signer0.publicKey, thresholdLevel: OperationThreshold.low },
        ],
        signers: [signer0, signer1, signer2],
      });

      assert(out instanceof Transaction);
      assertEquals(out.signatures.length, 1);
      assertEquals(signer0.calls, 1);
      assertEquals(signer1.calls, 0);
      assertEquals(signer2.calls, 0);
    });

    it("signs a Transaction with multiple requirements for different signers", async () => {
      const tx = buildTx(KPS[2].publicKey());
      const signer0 = createSigner(KPS[0]);
      const signer1 = createSigner(KPS[1]);
      const signer2 = createSigner(KPS[2]);

      const out = await SignEnvelope.run({
        transaction: tx,
        signatureRequirements: [
          { signer: signer0.publicKey, thresholdLevel: OperationThreshold.low },
          { signer: signer1.publicKey, thresholdLevel: OperationThreshold.low },
          { signer: signer2.publicKey, thresholdLevel: OperationThreshold.low },
        ],
        signers: [signer0, signer1, signer2],
      });

      assert(out instanceof Transaction);
      assertEquals(out.signatures.length, 3);
      assertEquals(signer0.calls, 1);
      assertEquals(signer1.calls, 1);
      assertEquals(signer2.calls, 1);
    });

    it("signs a Transaction multiple times with the same signer", async () => {
      const tx = buildTx(KPS[0].publicKey());
      const signer = createSigner(KPS[0]);

      const out = await SignEnvelope.run({
        transaction: tx,
        signatureRequirements: [
          { signer: signer.publicKey, thresholdLevel: OperationThreshold.low },
          { signer: signer.publicKey, thresholdLevel: OperationThreshold.low },
          { signer: signer.publicKey, thresholdLevel: OperationThreshold.low },
        ],
        signers: [signer],
      });

      assert(out instanceof Transaction);
      assertEquals(out.signatures.length, 3);
      assertEquals(signer.calls, 3);
    });

    it("signs a FeeBumpTransaction", async () => {
      const inner = buildTx(KPS[2].publicKey());
      const feeBump = buildFeeBump(KPS[0].publicKey(), inner);
      const signer = createSigner(KPS[0]);

      const out = await SignEnvelope.run({
        transaction: feeBump,
        signatureRequirements: [
          { signer: signer.publicKey, thresholdLevel: OperationThreshold.low },
        ],
        signers: [signer],
      });

      // Should remain a FeeBumpTransaction and have 1 signature
      assert(out instanceof FeeBumpTransaction);
      assertEquals(out.signatures.length, 1);
      assertEquals(signer.calls, 1);
    });
  });

  describe("Errors", () => {
    it("throws NO_REQUIREMENTS when no signature requirements are provided", async () => {
      const tx = buildTx(KPS[0].publicKey());
      const signer = createSigner(KPS[0]);

      await assertRejects(
        async () =>
          await SignEnvelope.run({
            transaction: tx,
            signatureRequirements: [],
            signers: [signer],
          }),
        E.NO_REQUIREMENTS
      );
    });

    it("throws NO_SIGNERS when no signers are provided", async () => {
      const tx = buildTx(KPS[0].publicKey());

      await assertRejects(
        async () =>
          await SignEnvelope.run({
            transaction: tx,
            signatureRequirements: [
              {
                signer: KPS[0].publicKey() as Ed25519PublicKey,
                thresholdLevel: OperationThreshold.low,
              },
            ],
            signers: [],
          }),
        E.NO_SIGNERS
      );
    });

    it("throws SIGNER_NOT_FOUND when a required signer is missing", async () => {
      const tx = buildTx(KPS[0].publicKey());
      const signer = createSigner(KPS[1]);

      await assertRejects(
        async () =>
          await SignEnvelope.run({
            transaction: tx,
            signatureRequirements: [
              {
                signer: KPS[0].publicKey() as Ed25519PublicKey,
                thresholdLevel: OperationThreshold.low,
              },
            ],
            signers: [signer],
          }),
        E.SIGNER_NOT_FOUND
      );
    });

    it("throws FAILED_TO_SIGN_TRANSACTION when signer returns invalid XDR", async () => {
      const tx = buildTx(KPS[0].publicKey());
      const badSigner = createFailingSigner(KPS[0].publicKey(), "invalidXDR");

      await assertRejects(
        async () =>
          await SignEnvelope.run({
            transaction: tx,
            signatureRequirements: [
              {
                signer: badSigner.publicKey,
                thresholdLevel: OperationThreshold.low,
              },
            ],
            signers: [badSigner],
          }),
        E.FAILED_TO_SIGN_TRANSACTION
      );
    });

    it("throws FAILED_TO_SIGN_TRANSACTION when signer throws", async () => {
      const tx = buildTx(KPS[0].publicKey());
      const badSigner = createFailingSigner(KPS[0].publicKey(), "throw");

      await assertRejects(
        async () =>
          await SignEnvelope.run({
            transaction: tx,
            signatureRequirements: [
              {
                signer: badSigner.publicKey,
                thresholdLevel: OperationThreshold.low,
              },
            ],
            signers: [badSigner],
          }),
        E.FAILED_TO_SIGN_TRANSACTION
      );
    });

    it("throws UNEXPECTED_ERROR on malformed input", async () => {
      const faultyInput = null as unknown as Parameters<
        typeof SignEnvelope.run
      >[0];

      await assertRejects(
        async () => await SignEnvelope.run(faultyInput),
        E.UNEXPECTED_ERROR
      );
    });
  });
});
