import { assert, assertFalse } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  isAuthEntrySigner,
  isEnvelopeSigner,
  isKeypairSigner,
  isSigner,
} from "@/common/type-guards/is-signer.ts";

describe("signer type guards", () => {
  const signsFor = () => true;

  it("recognizes an envelope-only signer", () => {
    const signer = {
      signsFor,
      signTransaction: () => "signed-xdr",
    };

    assert(isEnvelopeSigner(signer));
    assertFalse(isAuthEntrySigner(signer));
    assert(isSigner(signer));
    assertFalse(isKeypairSigner(signer));
  });

  it("recognizes an authorization-entry-only signer", () => {
    const signer = {
      signsFor,
      signSorobanAuthEntry: (entry: unknown) => Promise.resolve(entry),
    };

    assertFalse(isEnvelopeSigner(signer));
    assert(isAuthEntrySigner(signer));
    assert(isSigner(signer));
    assertFalse(isKeypairSigner(signer));
  });

  it("recognizes a complete keypair signer", () => {
    const signer = {
      publicKey: () => "GTEST",
      sign: (data: Uint8Array) => data,
      signsFor,
      signTransaction: () => "signed-xdr",
      signSorobanAuthEntry: (entry: unknown) => Promise.resolve(entry),
    };

    assert(isEnvelopeSigner(signer));
    assert(isAuthEntrySigner(signer));
    assert(isSigner(signer));
    assert(isKeypairSigner(signer));
  });

  it("rejects values without a supported signing capability", () => {
    for (const value of [undefined, null, {}, { signsFor }]) {
      assertFalse(isEnvelopeSigner(value));
      assertFalse(isAuthEntrySigner(value));
      assertFalse(isSigner(value));
      assertFalse(isKeypairSigner(value));
    }
  });
});
