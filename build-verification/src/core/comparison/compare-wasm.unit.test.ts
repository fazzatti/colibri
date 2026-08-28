import { assert, assertEquals, assertFalse } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { compareWasmBytes, sha256Hex } from "./compare-wasm.ts";

describe("core comparison", () => {
  it("hashes exact bytes as lowercase SHA-256", async () => {
    assertEquals(
      await sha256Hex(new TextEncoder().encode("abc")),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("compares raw arrays without substituting their hashes", () => {
    assert(compareWasmBytes(new Uint8Array(), new Uint8Array()));
    assert(compareWasmBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2])));
    assertFalse(compareWasmBytes(new Uint8Array([1]), new Uint8Array([1, 2])));
    assertFalse(
      compareWasmBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3])),
    );
  });
});
