# Render and style an identicon

## Installation and rendering

```sh
deno add jsr:@colibri/identicon
```

The following is a complete local script: save it as `icon.ts` and run
`deno run icon.ts`. It performs no network requests.

<!-- deno-check -->

```ts
import { Identicon } from "@colibri/identicon";

const icon = new Identicon(
  "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO",
);

// Use SVG markup, PNG bytes, or a data URL for an image's src attribute.
const svg = icon.toSvg();
const png = icon.toPng();
const src = icon.toDataUrl({ format: "svg" });
console.log(svg.length, png.length, src.slice(0, 30));
```

All generation/rendering methods are synchronous. PNG bytes use `Uint8Array`;
there is no Canvas, DOM, or Node Buffer requirement for generating an image.

Only checksummed [G-addresses](../../core/strkeys.md) and
[C-addresses](contract-addresses.md) are supported. Secret keys, raw contract-ID
bytes, malformed addresses and muxed addresses fail with
[`IdenticonCode.INVALID_PUBLIC_KEY`](errors-and-compatibility.md) rather than
being silently converted.

## Explicit presentation

Using the `icon` instance created above, choose explicit presentation options:

```ts
const src = icon.toDataUrl({
  format: "png",
  size: 224,
  padding: 7,
  background: "#FFFFFF",
  saturation: 0.7,
  value: 0.8,
});
```

Defaults are size 210, no padding, a transparent background, saturation 0.7, and
brightness (`value`) 0.8. Size is an integer from 7 to 4096. Padding is an
integer inset on each edge and must leave at least seven pixels for the grid.
Background accepts `"transparent"` or an opaque six-digit hex color. Saturation
and brightness accept finite numbers from 0 to 1.

The address-derived hue and pattern are unchanged by these controls. No dark
mode is inferred. SVG and PNG share integer pixel boundaries, including when the
drawable size is not divisible by seven.

[Package overview](../identicon.md)
