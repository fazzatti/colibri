import {
  assert,
  assertEquals,
  assertFalse,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { Buffer } from "node:buffer";
import {
  Account,
  hash,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "stellar-sdk";
import type { SignableTransaction } from "@/common/types/index.ts";
import { HashXSigner } from "@/signer/hash-x/index.ts";
import * as E from "@/signer/hash-x/error.ts";
import { StrKey } from "@/strkeys/index.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

describe("HashXSigner", () => {
  const account = Keypair.random().publicKey() as Ed25519PublicKey;
  const buildTransaction = () =>
    new TransactionBuilder(new Account(account, "1"), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.setOptions({}))
      .setTimeout(0)
      .build();

  it("derives its hash and exact X signer key from the preimage", () => {
    const preimage = Buffer.from("colibri");
    const signer = HashXSigner.fromPreimage(preimage);

    assertEquals(
      Buffer.from(signer.preimage() as Uint8Array).toString("hex"),
      preimage.toString("hex"),
    );
    assertEquals(
      signer.hash(),
      hash(preimage),
    );
    assertEquals(
      StrKey.decodeSha256Hash(signer.signerKey()),
      hash(preimage),
    );
  });

  it("returns defensive preimage, hash, and target copies", () => {
    const signer = HashXSigner.fromPreimage(Buffer.from("secret"));
    const preimage = signer.preimage() as Buffer;
    const digest = signer.hash() as Buffer;
    preimage.fill(0);
    digest.fill(0);

    assertNotEquals(signer.preimage(), preimage);
    assertNotEquals(signer.hash(), digest);
    assertEquals(signer.getTargets(), []);

    signer.addTarget(account);
    const targets = signer.getTargets();
    targets.length = 0;
    assert(signer.signsFor(account));
    assertEquals(signer.getTargets(), [account]);

    signer.removeTarget(account);
    assertFalse(signer.signsFor(account));
  });

  it("adds the preimage as a valid Hash-X decorated signature", () => {
    const preimage = Buffer.from([1, 2, 3]);
    const signer = HashXSigner.fromPreimage(preimage);
    const transaction = buildTransaction();

    const xdr = signer.signTransaction(transaction);
    const [signature] = transaction.signatures;

    assertEquals(xdr, transaction.toXdr());
    assertEquals(signature.signature.toBytes(), Uint8Array.from(preimage));
    assertEquals(
      signature.hint.toBytes(),
      Uint8Array.from(hash(preimage).subarray(-4)),
    );
  });

  it("creates a random 32-byte preimage and supports hiding it", () => {
    const signer = HashXSigner.generateRandom();
    const hidden = HashXSigner.generateRandom(true);

    assertEquals((signer.preimage() as Uint8Array).byteLength, 32);
    assertThrows(() => hidden.preimage(), E.PREIMAGE_NOT_ACCESSIBLE);
  });

  it("rejects preimages above Stellar's 64-byte limit", () => {
    assertThrows(
      () => HashXSigner.fromPreimage(Buffer.alloc(65)),
      E.INVALID_PREIMAGE_LENGTH,
    );
  });

  it("wraps unsupported preimage values", () => {
    assertThrows(
      () => HashXSigner.fromPreimage(null as unknown as ArrayBuffer),
      E.FAILED_TO_NORMALIZE_PREIMAGE,
    );
  });

  it("wraps secure random generation failures", () => {
    using _stub = stub(
      globalThis.crypto,
      "getRandomValues",
      () => {
        throw new Error("random failed");
      },
    );

    assertThrows(
      () => HashXSigner.generateRandom(),
      E.FAILED_TO_GENERATE_PREIMAGE,
    );
  });

  it("wraps signer-key encoding failures", () => {
    using _stub = stub(StrKey, "encodeSha256Hash", () => {
      throw new Error("encode failed");
    });

    assertThrows(
      () => HashXSigner.fromPreimage(Buffer.from("secret")),
      E.FAILED_TO_ENCODE_SIGNER_KEY,
    );
  });

  it("wraps digest derivation failures", () => {
    using _stub = stub(
      HashXSigner as unknown as {
        deriveHash(preimage: Buffer): Buffer;
      },
      "deriveHash",
      () => {
        throw new Error("hash failed");
      },
    );

    assertThrows(
      () => HashXSigner.fromPreimage(Buffer.from("secret")),
      E.FAILED_TO_DERIVE_HASH,
    );
  });

  it("preserves typed construction failures from random generation", () => {
    using _stub = stub(StrKey, "encodeSha256Hash", () => {
      throw new Error("encode failed");
    });

    assertThrows(
      () => HashXSigner.generateRandom(),
      E.FAILED_TO_ENCODE_SIGNER_KEY,
    );
  });

  it("wraps failures while adding the preimage signature", () => {
    const signer = HashXSigner.fromPreimage(Buffer.from("secret"));
    const transaction = {
      sign: () => {},
      signHashX: () => {
        throw new Error("sign failed");
      },
      toXdr: () => "",
    } as unknown as SignableTransaction;

    assertThrows(
      () => signer.signTransaction(transaction),
      E.FAILED_TO_ADD_PREIMAGE_SIGNATURE,
    );
  });

  it("wraps failures while serializing an authorized transaction", () => {
    const signer = HashXSigner.fromPreimage(Buffer.from("secret"));
    const transaction = {
      sign: () => {},
      signHashX: () => {},
      toXdr: () => {
        throw new Error("serialization failed");
      },
    } as unknown as SignableTransaction;

    assertThrows(
      () => signer.signTransaction(transaction),
      E.FAILED_TO_SERIALIZE_TRANSACTION,
    );
  });

  it("destroys retained preimage material idempotently", () => {
    const signer = HashXSigner.fromPreimage(Buffer.from("secret"));
    signer.destroy();
    signer.destroy();

    assertThrows(() => signer.preimage(), E.SIGNER_DESTROYED);
    assertThrows(
      () => signer.signTransaction(buildTransaction()),
      E.SIGNER_DESTROYED,
    );
  });

  it("destroys retained preimage material through Symbol.dispose", () => {
    let signer: HashXSigner;
    {
      using disposable = HashXSigner.fromPreimage(Buffer.from("secret"));
      signer = disposable;
    }

    assertThrows(() => signer.preimage(), E.SIGNER_DESTROYED);
  });
});
