import { assertEquals, assertNotStrictEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { generateRandomSalt } from "@/common/helpers/generate-random-salt.ts";

const { describe, it } = recordColibriTests(import.meta.url);

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
