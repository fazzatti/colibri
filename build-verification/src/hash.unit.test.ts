import { assert, assertEquals, assertFalse } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { equalBytes, sha256Hex } from "@/hash.ts";

describe("hash helpers", () => {
  it("hashes bytes as lowercase SHA-256", async () => {
    assertEquals(
      await sha256Hex(new TextEncoder().encode("abc")),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("compares equal and unequal byte arrays", () => {
    assert(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2])));
    assertFalse(equalBytes(new Uint8Array([1]), new Uint8Array([1, 2])));
    assertFalse(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3])));
  });
});
