import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { Keypair, StrKey, xdr } from "stellar-sdk";
import { parseAccountId } from "@/common/helpers/xdr/parse-account-id.ts";

describe("parseAccountId", () => {
  it("should parse AccountID to G... address", () => {
    const keypair = Keypair.random();
    // Create AccountID using PublicKey type
    const publicKey = xdr.PublicKey.publicKeyTypeEd25519(
      keypair.rawPublicKey()
    );

    const result = parseAccountId(publicKey);
    assertEquals(result, keypair.publicKey());
  });

  it("should parse AccountID from raw bytes", () => {
    // Create a known public key
    const publicKeyStr =
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const rawKey = StrKey.decodeEd25519PublicKey(publicKeyStr);
    const publicKey = xdr.PublicKey.publicKeyTypeEd25519(rawKey);

    const result = parseAccountId(publicKey);
    assertEquals(result, publicKeyStr);
  });
});
