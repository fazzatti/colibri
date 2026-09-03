import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { decodeBase64 } from "@std/encoding/base64";
import { decode } from "fast-png";
import { Resvg } from "resvg-test";
import { StrKey } from "stellar-sdk";
import { Identicon } from "@/identicon.ts";
import fixtures from "colibri-internal/identicon/vectors.json" with {
  type: "json",
};

describe("Real PNG and SVG rendering", () => {
  for (const vector of fixtures.vectors) {
    it(`matches every pixel of the captured Lobstr PNG for ${vector.publicKey}`, () => {
      const actual = decode(new Identicon(vector.publicKey).toPng(), {
        checkCrc: true,
      });
      const expected = decode(decodeBase64(vector.pngBase64), {
        checkCrc: true,
      });
      assertEquals(actual.width, 210);
      assertEquals(actual.height, 210);
      assertEquals(actual.channels, expected.channels);
      assertEquals(actual.data, expected.data);
    });
  }

  it("rasterizes SVG to exactly the same RGBA pixels as PNG across presentation options", () => {
    for (const vector of fixtures.vectors) {
      const icon = new Identicon(vector.publicKey);
      for (const size of [7, 8, 9, 14, 15, 31, 209, 210, 211, 224, 512]) {
        for (const background of ["transparent", "#17283A", "#ffffff"]) {
          const padding = size >= 31 ? 3 : 0;
          const options = {
            size,
            padding,
            background,
            saturation: 0.6,
            value: 0.9,
          };
          const renderer = new Resvg(icon.toSvg(options), {
            font: { loadSystemFonts: false },
          });
          const rendered = renderer.render();
          const svg = decode(rendered.asPng(), { checkCrc: true });
          const png = decode(icon.toPng(options), { checkCrc: true });
          assertEquals(svg.width, size);
          assertEquals(svg.height, size);
          assertEquals(
            svg.data,
            png.data,
            `size=${size}, background=${background}`,
          );
          // Read back every pixel's mirror: integer rounding must retain symmetry.
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const a = (y * size + x) * 4;
              const b = (y * size + size - 1 - x) * 4;
              for (let c = 0; c < 4; c++) {
                assertEquals(png.data[a + c], png.data[b + c]);
              }
            }
          }
        }
      }
    }
  });

  it("keeps padding and empty cells transparent, or fills them with the requested background", () => {
    const icon = new Identicon(fixtures.vectors[0].publicKey);
    const transparent = decode(icon.toPng({ size: 9, padding: 1 }));
    const opaque = decode(
      icon.toPng({ size: 9, padding: 1, background: "#123456" }),
    );
    const pixel = (data: typeof transparent.data, x: number, y: number) =>
      Array.from(data.slice((y * 9 + x) * 4, (y * 9 + x) * 4 + 4));
    for (const [x, y] of [[0, 0], [8, 8], [4, 1]]) {
      assertEquals(pixel(transparent.data, x, y), [0, 0, 0, 0]);
      assertEquals(pixel(opaque.data, x, y), [18, 52, 86, 255]);
    }
    assertEquals(pixel(transparent.data, 1, 1), [204, 98, 61, 255]);
  });

  it("preserves every RGBA channel at maximum size with background and full foreground passes", () => {
    // All selected pattern bits are set, so each of the 49 cells is filled.
    const publicKey = StrKey.encodeEd25519PublicKey(
      new Uint8Array(32).fill(255),
    );
    const image = decode(
      new Identicon(publicKey).toPng({ size: 4096, background: "#FFFFFF" }),
      { checkCrc: true },
    );
    assertEquals(image.width, 4096);
    assertEquals(image.height, 4096);
    assertEquals(image.channels, 4);
    assertEquals(image.data.length, 4096 * 4096 * 4);

    // Hue byte 255 wraps to red; foreground must replace every white pixel.
    const rgba = [204, 61, 61, 255];
    assert(image.data.every((channel, index) => channel === rgba[index % 4]));
  });
});
