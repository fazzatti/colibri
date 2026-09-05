import { assertEquals, assertInstanceOf, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Keypair } from "stellar-sdk";
import { LocalSigner } from "@/signer/local/index.ts";
import { isMessageSigner, isSigner } from "@/common/type-guards/is-signer.ts";
import type { MessageSigner } from "@/signer/types.ts";
import * as E from "@/signer/local/error.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";

describe("SEP-53 message signer capability", () => {
  it("signs text and equivalent UTF-8 bytes using the native format", () => {
    using signer = LocalSigner.generateRandom();
    const message = "Approve revision 42: olá 🐦";
    const bytes = new TextEncoder().encode(message);
    const verifier = Keypair.fromPublicKey(signer.publicKey());
    const signature = signer.signMessage(message);
    assertInstanceOf(signature, Uint8Array);
    assertEquals(signature.length, 64);
    assertEquals(signature, signer.signMessage(bytes));
    assertEquals(verifier.verifyMessage(message, signature), true);
    assertEquals(verifier.verifyMessage(bytes, signature), true);
    assertEquals(verifier.verifyMessage("different intent", signature), false);
    assertEquals(verifier.verify(bytes, signature), false);
    assertEquals(
      verifier.verifyMessage(message, toUint8Array(signer.sign(bytes))),
      false,
    );
  });

  it("supports empty messages and arbitrary binary bytes without conversion", () => {
    using signer = LocalSigner.generateRandom(true);
    const native = Keypair.fromPublicKey(signer.publicKey());
    for (
      const message of ["", new Uint8Array(), new Uint8Array([0, 255, 128])]
    ) {
      assertEquals(
        native.verifyMessage(message, signer.signMessage(message)),
        true,
      );
    }
  });

  it("uses unique typed errors for destroyed signers and invalid message input", () => {
    using signer = LocalSigner.generateRandom();
    const error = assertThrows(
      () => signer.signMessage(42 as unknown as Uint8Array),
      E.MESSAGE_SIGNING_FAILED,
    );
    assertInstanceOf(error.meta.cause, TypeError);
    assertEquals(error.code, E.Code.MESSAGE_SIGNING_FAILED);
    signer.destroy();
    const destroyed = assertThrows(
      () => signer.signMessage("message"),
      E.MESSAGE_SIGNER_DESTROYED,
    );
    assertEquals(destroyed.code, E.Code.MESSAGE_SIGNER_DESTROYED);
    assertEquals(E.ERROR_SIG_LOC[error.code], E.MESSAGE_SIGNING_FAILED);
    assertEquals(E.ERROR_SIG_LOC[destroyed.code], E.MESSAGE_SIGNER_DESTROYED);
  });

  it("recognizes sync and asynchronous capabilities without granting transaction eligibility", async () => {
    using local = LocalSigner.generateRandom();
    const messageOnly: MessageSigner = {
      publicKey: () => local.publicKey(),
      signMessage: (message) => Promise.resolve(local.signMessage(message)),
    };
    assertEquals(isMessageSigner(local), true);
    assertEquals(isMessageSigner(messageOnly), true);
    assertEquals(isSigner(messageOnly), false);
    assertEquals(
      Keypair.fromPublicKey(messageOnly.publicKey()).verifyMessage(
        "message",
        await messageOnly.signMessage("message"),
      ),
      true,
    );
  });

  it("rejects absent, non-callable and incomplete capability members", () => {
    for (
      const value of [
        null,
        undefined,
        42,
        {},
        { publicKey: "G...", signMessage: () => new Uint8Array() },
        { publicKey: () => "G..." },
        { publicKey: () => "G...", signMessage: "not callable" },
      ]
    ) assertEquals(isMessageSigner(value), false);
  });
});
