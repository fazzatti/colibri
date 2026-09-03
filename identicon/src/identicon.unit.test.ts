import {
  assert,
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { decodeBase64 } from "@std/encoding/base64";
import { decode } from "fast-png";
import { ColibriError } from "@colibri/core";
import { Identicon } from "@/identicon.ts";
import { IdenticonCode, IdenticonError } from "@/error/index.ts";
import { encodePng } from "@/renderers/png.ts";
import type {
  IdenticonDataUrlOptions,
  IdenticonOptions,
} from "@/core/types.ts";
import fixtures from "colibri-internal/identicon/vectors.json" with {
  type: "json",
};

const publicKey = fixtures.vectors[0].publicKey;

describe("Identicon", () => {
  it("exposes immutable identity data and renders deterministic default output", () => {
    const icon = new Identicon(publicKey);
    assertEquals(icon.publicKey, publicKey);
    assertEquals(icon.matrix.length, 7);
    assertEquals(icon.color, { r: 204, g: 98, b: 61 });
    assert(Object.isFrozen(icon.color));
    assert(Object.isFrozen(icon.matrix));
    assertEquals(
      icon.toSvg(),
      icon.toSvg({
        size: 210,
        padding: 0,
        background: "transparent",
        saturation: 0.7,
        value: 0.8,
      }),
    );
    assertEquals(icon.toPng(), new Identicon(publicKey).toPng());
    assertEquals(icon.toPng().constructor, Uint8Array);
  });

  it("encodes PNG and SVG data URLs without changing the rendered content", () => {
    const icon = new Identicon(publicKey);
    const options = {
      size: 224,
      padding: 14,
      background: "#ffffff",
      value: 0.9,
    };
    const svg = icon.toDataUrl({ ...options, format: "svg" });
    const png = icon.toDataUrl({ ...options, format: "png" });
    assert(svg.startsWith("data:image/svg+xml;base64,"));
    assert(png.startsWith("data:image/png;base64,"));
    assertEquals(
      new TextDecoder().decode(decodeBase64(svg.split(",")[1])),
      icon.toSvg(options),
    );
    assertEquals(decodeBase64(png.split(",")[1]), icon.toPng(options));
  });

  it("leaves the default color and caller options unchanged by render overrides", () => {
    const icon = new Identicon(publicKey);
    const original = icon.toSvg();
    const options = Object.freeze({ saturation: 0, value: 1 });
    const png = decode(icon.toPng(options));
    assertEquals(Array.from(png.data.slice(0, 4)), [255, 255, 255, 255]);
    assertNotEquals(icon.toSvg(options), original);
    assertEquals(icon.toSvg(), original);
    assertEquals(icon.color, { r: 204, g: 98, b: 61 });
    assertEquals(options, { saturation: 0, value: 1 });
    assert(icon.toSvg({ value: 0 }).includes("rgb(0,0,0)"));
    assert(
      icon.toSvg({ saturation: 1, value: 1 }).includes('fill="rgb(255,66,0)"'),
    );
  });

  it("accepts size and padding boundaries, including uneven cell dimensions", () => {
    const icon = new Identicon(publicKey);
    assert(icon.toSvg({ size: 4096 }).includes('width="4096"'));
    assertEquals(decode(icon.toPng({ size: 7 })).width, 7);
    assertEquals(decode(icon.toPng({ size: 9, padding: 1 })).width, 9);
    assert(icon.toSvg({ background: "#aBcDeF" }).includes("rgb(171,205,239)"));
  });

  it("uses a unique stable error for each validation occurrence", () => {
    const icon = new Identicon(publicKey);
    const cases: [IdenticonOptions, IdenticonCode][] = [];
    for (const size of [NaN, Infinity, -1, 0, 6, 4097, 1.5, "210", null]) {
      cases.push([{ size } as IdenticonOptions, IdenticonCode.INVALID_SIZE]);
    }
    for (const padding of [NaN, Infinity, -1, 0.5, "1", null]) {
      cases.push([
        { padding } as IdenticonOptions,
        IdenticonCode.INVALID_PADDING,
      ]);
    }
    cases.push([
      { size: 7, padding: 1 },
      IdenticonCode.INSUFFICIENT_DRAWING_AREA,
    ]);
    for (const saturation of [NaN, Infinity, -0.1, 1.1, "0.7", null]) {
      cases.push([
        { saturation } as IdenticonOptions,
        IdenticonCode.INVALID_SATURATION,
      ]);
    }
    for (const value of [NaN, Infinity, -0.1, 1.1, "0.8", null]) {
      cases.push([{ value } as IdenticonOptions, IdenticonCode.INVALID_VALUE]);
    }
    for (
      const background of [
        "white",
        "#fff",
        "#12345678",
        "#xyzxyz",
        '"><script/>',
        "",
        0,
        null,
      ]
    ) {
      cases.push([
        { background } as IdenticonOptions,
        IdenticonCode.INVALID_BACKGROUND,
      ]);
    }
    for (const [options, code] of cases) {
      for (
        const render of [
          () => icon.toSvg(options),
          () => icon.toPng(options),
          () => icon.toDataUrl({ ...options, format: "png" }),
        ]
      ) {
        const error = assertThrows(render, IdenticonError);
        assertEquals(error.code, code);
        assert(error instanceof ColibriError);
        assertEquals(error.source, "@colibri/identicon");
        assertEquals(error.name, `IdenticonError ${code}`);
        assertEquals(error.toJSON().code, code);
      }
    }
  });

  it("rejects non-object options and absent or unknown data URL formats", () => {
    const icon = new Identicon(publicKey);
    for (const options of [null, [], 1, "svg", true]) {
      const error = assertThrows(
        () => icon.toSvg(options as IdenticonOptions),
        IdenticonError,
      );
      assertEquals(error.code, IdenticonCode.INVALID_OPTIONS);
    }
    for (const options of [undefined, null, []]) {
      assertEquals(
        assertThrows(
          () => icon.toDataUrl(options as unknown as IdenticonDataUrlOptions),
          IdenticonError,
        ).code,
        IdenticonCode.INVALID_OPTIONS,
      );
    }
    for (const format of [undefined, null, "jpeg", "SVG", 0]) {
      assertEquals(
        assertThrows(
          () => icon.toDataUrl({ format } as IdenticonDataUrlOptions),
          IdenticonError,
        ).code,
        IdenticonCode.INVALID_FORMAT,
      );
    }
  });

  it("wraps a real PNG encoder rejection with its original cause", () => {
    const error = assertThrows(
      () => encodePng(7, new Uint8Array(0)),
      IdenticonError,
    );
    assertEquals(error.code, IdenticonCode.PNG_ENCODING_FAILED);
    assert(error.meta?.cause instanceof Error);
    assertEquals(error.meta?.data, { size: 7 });
  });
});
