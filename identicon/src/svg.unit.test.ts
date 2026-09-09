import {
  assertEquals,
  assertInstanceOf,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriError } from "@colibri/core/errors";
import {
  Identicon,
  type IdenticonOptions,
  identiconSvg as rootSvg,
} from "@colibri/identicon";
import { IdenticonError, identiconSvg } from "@colibri/identicon/svg";
import { StrKey } from "stellar-sdk";
import fixtures from "colibri-internal/identicon/vectors.json" with {
  type: "json",
};

describe("SVG-only public renderer", () => {
  it("shares the root function and matches the class for all hue bytes and both address types", () => {
    assertStrictEquals(rootSvg, identiconSvg);
    const addresses = fixtures.vectors.map((vector) => vector.publicKey);
    for (let hue = 0; hue < 256; hue++) {
      const raw = Uint8Array.from(
        { length: 32 },
        (_, index) => (index * 37 + hue) % 256,
      );
      raw[1] = hue;
      addresses.push(
        StrKey.encodeEd25519PublicKey(raw),
        StrKey.encodeContract(raw),
      );
    }
    const options: IdenticonOptions[] = [{}, { size: 9, padding: 1 }, {
      size: 224,
      padding: 14,
      background: "#aBcDeF",
      saturation: 0.5,
      value: 0.9,
    }, { saturation: 0, value: 0 }];
    for (const address of addresses) {
      assertEquals(identiconSvg(address), new Identicon(address).toSvg());
      for (const option of options) {
        Object.freeze(option);
        assertEquals(
          identiconSvg(address, option),
          new Identicon(address).toSvg(option),
        );
      }
    }
  });
  it("preserves structured failures and address-before-options validation", () => {
    const valid = fixtures.vectors[0].publicKey;
    const cases: [string, IdenticonOptions][] = [
      ["invalid", { size: 0 }],
      [valid, { size: 0 }],
      [valid, { padding: -1 }],
      [valid, { background: "<script>" }],
      [valid, { saturation: -1 }],
      [valid, { value: 2 }],
      [valid, { size: 7, padding: 1 }],
      [valid, null as unknown as IdenticonOptions],
    ];
    for (const [address, options] of cases) {
      const actual = assertThrows(
        () => identiconSvg(address, options),
        IdenticonError,
      );
      const expected = assertThrows(
        () => new Identicon(address).toSvg(options),
        IdenticonError,
      );
      assertInstanceOf(actual, ColibriError);
      assertEquals(actual.toJSON(), expected.toJSON());
    }
  });
});
