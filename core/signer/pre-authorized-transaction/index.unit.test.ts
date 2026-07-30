import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { Buffer } from "buffer";
import {
  Account,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "stellar-sdk";
import type { SignableTransaction } from "@/common/types/index.ts";
import { PreAuthorizedTransactionSigner } from "@/signer/pre-authorized-transaction/index.ts";
import * as E from "@/signer/pre-authorized-transaction/error.ts";
import { StrKey } from "@/strkeys/index.ts";
import type { Ed25519PublicKey, PreAuthTx } from "@/strkeys/types.ts";

describe("PreAuthorizedTransactionSigner", () => {
  const account = Keypair.random().publicKey() as Ed25519PublicKey;
  const buildTransaction = (sequence = "1") =>
    new TransactionBuilder(new Account(account, sequence), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.setOptions({}))
      .setTimeout(0)
      .build();

  it("creates an exact T signer key from a finalized transaction", () => {
    const transaction = buildTransaction();
    const signer = PreAuthorizedTransactionSigner.fromTransaction(transaction);

    assertEquals(
      Buffer.from(signer.hash() as Uint8Array).toString("hex"),
      transaction.hash().toString("hex"),
    );
    assertEquals(
      StrKey.decodePreAuthTx(signer.signerKey()).toString("hex"),
      transaction.hash().toString("hex"),
    );
    assert(signer.authorizesTransaction(transaction));
    assertFalse(signer.authorizesTransaction(buildTransaction("2")));
  });

  it("creates equivalent signers from raw hashes and T keys", () => {
    const hash = buildTransaction().hash();
    const fromHash = PreAuthorizedTransactionSigner.fromHash(hash);
    const fromKey = PreAuthorizedTransactionSigner.fromHash(
      fromHash.signerKey(),
    );

    assertEquals(
      Buffer.from(fromHash.hash() as Uint8Array).toString("hex"),
      Buffer.from(fromKey.hash() as Uint8Array).toString("hex"),
    );
    assertEquals(fromHash.signerKey(), fromKey.signerKey());
  });

  it("returns defensive hash and target copies", () => {
    const signer = PreAuthorizedTransactionSigner.fromHash(Buffer.alloc(32, 1));
    const hash = signer.hash() as Buffer;
    hash.fill(0);

    assertFalse(Buffer.from(signer.hash() as Uint8Array).equals(hash));
    assertEquals(signer.getTargets(), []);

    signer.addTarget(account);
    const targets = signer.getTargets();
    targets.length = 0;
    assert(signer.signsFor(account));
    assertEquals(signer.getTargets(), [account]);

    signer.removeTarget(account);
    assertFalse(signer.signsFor(account));
  });

  it("rejects raw transaction hashes with invalid lengths", () => {
    assertThrows(
      () => PreAuthorizedTransactionSigner.fromHash(Buffer.alloc(31)),
      E.INVALID_TRANSACTION_HASH_LENGTH,
    );
  });

  it("wraps unsupported raw transaction-hash values", () => {
    assertThrows(
      () =>
        PreAuthorizedTransactionSigner.fromHash(
          null as unknown as ArrayBuffer,
        ),
      E.FAILED_TO_NORMALIZE_TRANSACTION_HASH,
    );
  });

  it("wraps invalid T signer keys", () => {
    assertThrows(
      () =>
        PreAuthorizedTransactionSigner.fromHash(
          "TINVALID" as PreAuthTx,
        ),
      E.FAILED_TO_DECODE_SIGNER_KEY,
    );
  });

  it("wraps signer-key encoding failures", () => {
    using _stub = stub(StrKey, "encodePreAuthTx", () => {
      throw new Error("encode failed");
    });

    assertThrows(
      () => PreAuthorizedTransactionSigner.fromHash(Buffer.alloc(32)),
      E.FAILED_TO_ENCODE_SIGNER_KEY,
    );
  });

  it("wraps transaction hashing failures during creation", () => {
    const transaction = {
      hash: () => {
        throw new Error("hash failed");
      },
    } as unknown as SignableTransaction;

    assertThrows(
      () => PreAuthorizedTransactionSigner.fromTransaction(transaction),
      E.FAILED_TO_HASH_TRANSACTION_DURING_CREATION,
    );
  });

  it("preserves typed hash validation failures during creation", () => {
    const transaction = {
      hash: () => Buffer.alloc(31),
    } as unknown as SignableTransaction;

    assertThrows(
      () => PreAuthorizedTransactionSigner.fromTransaction(transaction),
      E.INVALID_TRANSACTION_HASH_LENGTH,
    );
  });

  it("wraps transaction hashing failures during authorization", () => {
    const signer = PreAuthorizedTransactionSigner.fromHash(Buffer.alloc(32));
    const transaction = {
      hash: () => {
        throw new Error("hash failed");
      },
    } as unknown as SignableTransaction;

    assertThrows(
      () => signer.authorizesTransaction(transaction),
      E.FAILED_TO_HASH_TRANSACTION_DURING_AUTHORIZATION,
    );
  });
});
