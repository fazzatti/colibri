import {
  assert,
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { StrKey } from "stellar-sdk";
import { generateIdenticon } from "@/core/generate.ts";
import { IdenticonCode, IdenticonError } from "@/error/index.ts";
import fixtures from "colibri-internal/identicon/vectors.json" with {
  type: "json",
};

describe("SEP-33 reference generation", () => {
  for (const vector of fixtures.vectors) {
    it(`matches independently captured color and matrix for ${vector.publicKey}`, () => {
      const data = generateIdenticon(vector.publicKey);
      assertEquals(data.publicKey, vector.publicKey);
      assertEquals([data.color.r, data.color.g, data.color.b], vector.color);
      assertEquals(
        data.matrix.map((row) => row.map(Number).join("")),
        vector.matrix,
      );
    });
  }

  it("matches independently calculated RGB for all 256 hue bytes", () => {
    for (let byte = 0; byte < 256; byte++) {
      const raw = new Uint8Array(32);
      raw[1] = byte;
      const data = generateIdenticon(StrKey.encodeEd25519PublicKey(raw));
      assertEquals(data.hue, byte / 255);
      assertEquals(
        [data.color.r, data.color.g, data.color.b],
        fixtures.hues[byte],
      );
    }
  });

  it("maps all 28 independent bits to their row, column and mirror", () => {
    for (let bit = 0; bit < 28; bit++) {
      const raw = new Uint8Array(32);
      raw[2 + Math.floor(bit / 8)] = 128 >> (bit % 8);
      const { matrix } = generateIdenticon(StrKey.encodeEd25519PublicKey(raw));
      const row = Math.floor(bit / 4);
      const col = bit % 4;
      const filled = matrix.flatMap((cells, r) =>
        cells.flatMap((value, c) => value ? [[r, c]] : [])
      );
      const expected = col === 3 ? [[row, 3]] : [[row, col], [row, 6 - col]];
      assertEquals(filled, expected);
    }
  });

  it("ignores unused key bits without silently changing the algorithm", () => {
    const raw = StrKey.decodeEd25519PublicKey(fixtures.vectors[0].publicKey);
    const original = generateIdenticon(StrKey.encodeEd25519PublicKey(raw));
    raw[0] ^= 255;
    raw[5] ^= 15;
    raw.fill(255, 6);
    const changed = generateIdenticon(StrKey.encodeEd25519PublicKey(raw));
    assertNotEquals(original.publicKey, changed.publicKey);
    assertEquals(original.matrix, changed.matrix);
    assertEquals(original.color, changed.color);
  });

  it("deep-freezes generated data and keeps repeated calls deterministic", () => {
    const data = generateIdenticon(fixtures.vectors[0].publicKey);
    assert(Object.isFrozen(data));
    assert(Object.isFrozen(data.color));
    assert(Object.isFrozen(data.matrix));
    for (const row of data.matrix) assert(Object.isFrozen(row));
    assertThrows(() => (data.matrix as boolean[][])[0][0] = false, TypeError);
    assertThrows(() => (data.color as { r: number }).r = 0, TypeError);
    assertEquals(generateIdenticon(data.publicKey), data);
  });

  it("rejects malformed, non-G and incorrectly checksummed inputs", () => {
    const valid = fixtures.vectors[0].publicKey;
    const invalid: unknown[] = [
      "",
      "G...",
      valid.toLowerCase(),
      valid.slice(0, -1) + "A",
      StrKey.encodeContract(new Uint8Array(32)),
      StrKey.encodeEd25519SecretSeed(new Uint8Array(32)),
      StrKey.encodeMed25519PublicKey(new Uint8Array(40)),
      null,
      undefined,
      42,
      [],
      {},
    ];
    for (const input of invalid) {
      const error = assertThrows(
        () => generateIdenticon(input as string),
        IdenticonError,
      );
      assertEquals(error.code, IdenticonCode.INVALID_PUBLIC_KEY);
    }
  });
});
