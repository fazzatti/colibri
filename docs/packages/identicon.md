# Identicons

`@colibri/identicon` generates the familiar symmetric SEP-33 account image
locally. It accepts Stellar Ed25519 G-addresses and extends the same algorithm
to C-address contract IDs. Pattern and color are derived without querying a
server. An address produces the same result on every network, including when the
account has never been funded or the contract has not been deployed.

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

Only checksummed `G...` and `C...` addresses are supported. Secret keys, raw
contract-ID bytes, malformed addresses and muxed addresses fail with
`IdenticonCode.INVALID_PUBLIC_KEY` rather than being silently converted.

## Contract addresses: Colibri extension

[SEP-33](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0033.md)
defines account identicons for G-addresses. Contract-address support is a
Colibri extension, not a standardized SEP-33 contract variant.[^contracts]

This complete script uses a checksummed C-address from SEP-23's test vectors. It
generates an image locally and does not require a deployed contract:

<!-- deno-check -->

```ts
import { generateIdenticon, Identicon } from "@colibri/identicon";

const contractAddress =
  "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA";

// Decode the contract ID and reuse the account color/pattern algorithm.
const icon = new Identicon(contractAddress);
const svg = icon.toSvg();
const png = icon.toPng();
const src = icon.toDataUrl({ format: "svg" });

// The standalone generator also accepts C-addresses for custom renderers.
const { matrix, color } = generateIdenticon(contractAddress);
console.log(svg.length, png.length, src.slice(0, 30), matrix, color);
```

For a G-address, the input bytes are the 32-byte public key itself. For a
C-address, they are the 32-byte contract ID, not the Wasm hash. Both use the
same byte selection, hue, matrix and rendering code. No additional hashing or
address-type marker is applied. Existing account images are unchanged.

## Explicit presentation

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

## Custom renderers

```ts
import { generateIdenticon } from "@colibri/identicon";

const { matrix, color, hue } = generateIdenticon(
  "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO",
);
```

`matrix[row][column]` is a boolean; `true` means a filled foreground cell.
`color` holds integer `r`, `g`, and `b` channels. `hue` is between 0 and 1. The
result is deeply frozen. The class also exposes readonly `matrix` and `color`
getters.

The result and class retain their existing `publicKey` property for API
compatibility. It returns the supplied G-address or C-address; the name does not
mean that a contract ID is an Ed25519 public key.

## Errors and compatibility

All validation and PNG encoding failures use `IdenticonError`, a Colibri error
with a distinct code per validation. Handle it with `instanceof IdenticonError`
and inspect its `code`, such as `INVALID_SIZE` or `INVALID_BACKGROUND`. Failed
encoder calls preserve their original cause in `meta?.cause`.

Defaults follow the longstanding Lobstr reference implementation. This
intentionally uses the equivalent of raw public-key bytes `[1, 15)`, not the
literal SEP's differing `[2, 16)` offset. See the
[package README compatibility footnote](https://github.com/fazzatti/colibri/tree/main/identicon#user-content-fn-compatibility-1)
for the exact distinction and pinned reference.

Identicons can collide and are not proof of ownership. They help recognize
accounts and contracts visually, but never replace checking the complete
destination address and its type.

See [every identicon error](../reference/errors/identicon.md) and the
[API reference](https://jsr.io/@colibri/identicon/doc). For browser rendering,
assign a data URL to an image's `src` and give the image meaningful alt text;
visual resemblance is not an authentication check.

[^contracts]: Until an ecosystem standard defines C-address identicons, Colibri
    deliberately applies the same algorithm as for G-addresses. Accidental image
    matches between unrelated addresses are unlikely in individual comparisons,
    but the image uses only eight hue bits and 28 pattern bits rather than the
    full payload. Equal G/C payloads always produce the same icon; different
    payloads can also collide. This tradeoff is suitable for visual recognition,
    not identity verification or authorization.
