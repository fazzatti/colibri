import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { Keypair, xdr } from "stellar-sdk";
import { parseMuxedAccount } from "@/common/helpers/xdr/parse-muxed-account.ts";
import { UNKNOWN_MUXED_ACCOUNT_TYPE } from "@/common/helpers/xdr/error.ts";

describe("parseMuxedAccount", () => {
  it("should parse regular Ed25519 account to G... address", () => {
    const keypair = Keypair.random();
    const muxed = xdr.MuxedAccount.keyTypeEd25519(keypair.rawPublicKey());

    const result = parseMuxedAccount(muxed);
    assertEquals(result, keypair.publicKey());
  });

  it("should parse muxed Ed25519 account to M... address", () => {
    const keypair = Keypair.random();
    const muxed = xdr.MuxedAccount.keyTypeMuxedEd25519(
      new xdr.MuxedAccountMed25519({
        id: xdr.Uint64.fromString("12345"),
        ed25519: keypair.rawPublicKey(),
      })
    );

    const result = parseMuxedAccount(muxed);
    assertStringIncludes(result, "M");
  });

  it("should throw UNKNOWN_MUXED_ACCOUNT_TYPE for invalid muxed account type", () => {
    // Create a mock muxed account with an unknown type
    const mockMuxed = {
      switch: () => ({ name: "keyTypeUnknown", value: 99 }),
    };

    assertThrows(
      // deno-lint-ignore no-explicit-any
      () => parseMuxedAccount(mockMuxed as any),
      UNKNOWN_MUXED_ACCOUNT_TYPE,
      "Unknown muxed account type"
    );
  });
});
