import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { Buffer } from "buffer";
import {
  Account,
  Keypair,
  Networks,
  Operation,
  SignerKey as StellarSignerKey,
  StrKey as StellarStrKey,
  TransactionBuilder,
} from "stellar-sdk";
import type { BinaryData, SignableTransaction } from "@/common/types/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { Ed25519SignedPayloadSigner } from "@/signer/signed-payload/index.ts";
import * as E from "@/signer/signed-payload/error.ts";
import type { Ed25519PublicKey, SignedPayload } from "@/strkeys/types.ts";

describe("Ed25519SignedPayloadSigner", () => {
  const keypair = Keypair.random();
  const localSigner = LocalSigner.fromSecret(keypair.secret() as `S${string}`);
  const account = Keypair.random().publicKey() as Ed25519PublicKey;
  const buildTransaction = (sequence = "1") =>
    new TransactionBuilder(new Account(account, sequence), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.setOptions({}))
      .setTimeout(0)
      .build();

  it("builds an exact P signer key containing the key and payload", () => {
    const payload = Buffer.from("colibri");
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: localSigner,
      payload,
    });
    const decoded = StellarStrKey.decodeSignedPayload(signer.signerKey());

    assertEquals(signer.publicKey(), localSigner.publicKey());
    assertEquals(
      Buffer.from(signer.payload() as Uint8Array).toString("hex"),
      payload.toString("hex"),
    );
    assertEquals(
      decoded.subarray(0, 32).toString("hex"),
      StellarStrKey.decodeEd25519PublicKey(localSigner.publicKey()).toString(
        "hex",
      ),
    );
    assertEquals(decoded.readUInt32BE(32), payload.length);
    assertEquals(
      decoded.subarray(36, 36 + payload.length).toString("hex"),
      payload.toString("hex"),
    );
  });

  it("binds the convenience factory to one exact transaction hash", () => {
    const transaction = buildTransaction();
    const signer = Ed25519SignedPayloadSigner.forTransaction({
      signer: localSigner,
      transaction,
    });

    assertEquals(
      Buffer.from(signer.payload() as Uint8Array).toString("hex"),
      transaction.hash().toString("hex"),
    );
  });

  it("signs the raw payload and builds Stellar's payload-aware hint", () => {
    const payload = Buffer.from([9]);
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: localSigner,
      payload,
    });
    const transaction = buildTransaction();

    const xdr = signer.signTransaction(transaction);
    const [decorated] = transaction.signatures;
    const publicKeyHint = keypair.rawPublicKey().subarray(-4);
    const paddedPayloadHint = Buffer.from([9, 0, 0, 0]);
    const expectedHint = Buffer.from(
      paddedPayloadHint.map((byte, index) => byte ^ publicKeyHint[index]),
    );

    assertEquals(xdr, transaction.toXDR());
    assertEquals(decorated.hint(), expectedHint);
    assert(keypair.verify(payload, decorated.signature()));
    assertFalse(keypair.verify(transaction.hash(), decorated.signature()));
  });

  it("uses the final four payload bytes when the payload is longer", () => {
    const payload = Buffer.from([1, 2, 3, 4, 5]);
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: localSigner,
      payload,
    });
    const transaction = buildTransaction();
    signer.signTransaction(transaction);

    const publicKeyHint = keypair.rawPublicKey().subarray(-4);
    const expectedHint = Buffer.from(
      payload.subarray(-4).map((byte, index) => byte ^ publicKeyHint[index]),
    );
    assertEquals(transaction.signatures[0].hint(), expectedHint);
  });

  it("returns defensive payload and target copies", () => {
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: localSigner,
      payload: Buffer.from("payload"),
    });
    const payload = signer.payload() as Buffer;
    payload.fill(0);

    assertFalse(Buffer.from(signer.payload() as Uint8Array).equals(payload));
    assertEquals(signer.getTargets(), []);

    signer.addTarget(account);
    const targets = signer.getTargets();
    targets.length = 0;
    assert(signer.signsFor(account));
    assertEquals(signer.getTargets(), [account]);

    signer.removeTarget(account);
    assertFalse(signer.signsFor(account));
  });

  it("rejects empty and oversized payloads", () => {
    for (const payload of [Buffer.alloc(0), Buffer.alloc(65)]) {
      assertThrows(
        () =>
          Ed25519SignedPayloadSigner.fromPayload({
            signer: localSigner,
            payload,
          }),
        E.INVALID_PAYLOAD_LENGTH,
      );
    }
  });

  it("wraps unsupported payload values", () => {
    assertThrows(
      () =>
        Ed25519SignedPayloadSigner.fromPayload({
          signer: localSigner,
          payload: null as unknown as ArrayBuffer,
        }),
      E.FAILED_TO_NORMALIZE_PAYLOAD,
    );
  });

  it("wraps public-key lookup failures", () => {
    assertThrows(
      () =>
        Ed25519SignedPayloadSigner.fromPayload({
          signer: {
            publicKey: () => {
              throw new Error("public key failed");
            },
            sign: (data: BinaryData) => data,
          },
          payload: Buffer.from("payload"),
        }),
      E.FAILED_TO_GET_PUBLIC_KEY,
    );
  });

  it("wraps malformed Ed25519 public keys", () => {
    assertThrows(
      () =>
        Ed25519SignedPayloadSigner.fromPayload({
          signer: {
            publicKey: () => "GINVALID" as Ed25519PublicKey,
            sign: (data: BinaryData) => data,
          },
          payload: Buffer.from("payload"),
        }),
      E.FAILED_TO_DECODE_PUBLIC_KEY,
    );
  });

  it("wraps failures while building signer-key XDR", () => {
    using _stub = stub(
      Ed25519SignedPayloadSigner as unknown as {
        buildSignerKeyXdr(publicKey: Buffer, payload: Buffer): never;
      },
      "buildSignerKeyXdr",
      () => {
        throw new Error("xdr failed");
      },
    );

    assertThrows(
      () =>
        Ed25519SignedPayloadSigner.fromPayload({
          signer: localSigner,
          payload: Buffer.from("payload"),
        }),
      E.FAILED_TO_BUILD_SIGNER_KEY_XDR,
    );
  });

  it("wraps failures while encoding the P signer key", () => {
    using _stub = stub(
      StellarSignerKey,
      "encodeSignerKey",
      () => {
        throw new Error("encode failed");
      },
    );

    assertThrows(
      () =>
        Ed25519SignedPayloadSigner.fromPayload({
          signer: localSigner,
          payload: Buffer.from("payload"),
        }),
      E.FAILED_TO_ENCODE_SIGNER_KEY,
    );
  });

  it("wraps future transaction hashing failures", () => {
    assertThrows(
      () =>
        Ed25519SignedPayloadSigner.forTransaction({
          signer: localSigner,
          transaction: {
            hash: () => {
              throw new Error("hash failed");
            },
          } as unknown as SignableTransaction,
        }),
      E.FAILED_TO_HASH_TRANSACTION,
    );
  });

  it("wraps payload signing failures", () => {
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: {
        publicKey: () => localSigner.publicKey(),
        sign: () => {
          throw new Error("sign failed");
        },
      },
      payload: Buffer.from("payload"),
    });

    assertThrows(
      () => signer.signTransaction(buildTransaction()),
      E.FAILED_TO_SIGN_PAYLOAD,
    );
  });

  it("wraps unsupported signature values", () => {
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: {
        publicKey: () => localSigner.publicKey(),
        sign: () => null as unknown as ArrayBuffer,
      },
      payload: Buffer.from("payload"),
    });

    assertThrows(
      () => signer.signTransaction(buildTransaction()),
      E.FAILED_TO_NORMALIZE_SIGNATURE,
    );
  });

  it("wraps invalid decorated signatures before mutating the envelope", () => {
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: {
        publicKey: () => localSigner.publicKey(),
        sign: () => Buffer.alloc(65),
      },
      payload: Buffer.from("payload"),
    });

    assertThrows(
      () => signer.signTransaction(buildTransaction()),
      E.FAILED_TO_BUILD_DECORATED_SIGNATURE,
    );
  });

  it("wraps failures while adding a decorated signature", () => {
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: localSigner,
      payload: Buffer.from("payload"),
    });
    const transaction = {
      sign: () => {},
      addDecoratedSignature: () => {
        throw new Error("add failed");
      },
      toXDR: () => "",
    } as unknown as SignableTransaction;

    assertThrows(
      () => signer.signTransaction(transaction),
      E.FAILED_TO_ADD_DECORATED_SIGNATURE,
    );
  });

  it("wraps failures while serializing the authorized transaction", () => {
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: localSigner,
      payload: Buffer.from("payload"),
    });
    const transaction = {
      sign: () => {},
      addDecoratedSignature: () => {},
      toXDR: () => {
        throw new Error("serialization failed");
      },
    } as unknown as SignableTransaction;

    assertThrows(
      () => signer.signTransaction(transaction),
      E.FAILED_TO_SERIALIZE_TRANSACTION,
    );
  });

  it("exposes its signer key as the signed-payload StrKey type", () => {
    const signer = Ed25519SignedPayloadSigner.fromPayload({
      signer: localSigner,
      payload: Buffer.from("payload"),
    });

    const key: SignedPayload = signer.signerKey();
    assert(key.startsWith("P"));
  });
});
