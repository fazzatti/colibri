import { assertEquals, assertNotStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { generateRandomSalt } from "@/common/helpers/generate-random-salt.ts";

describe("generateRandomSalt", () => {
  it("returns independent 32-byte Uint8Array salts", () => {
    const first = generateRandomSalt();
    const second = generateRandomSalt();

    assertEquals(first instanceof Uint8Array, true);
    assertEquals(first.length, 32);
    assertEquals(second.length, 32);
    assertNotStrictEquals(first, second);
  });
});
