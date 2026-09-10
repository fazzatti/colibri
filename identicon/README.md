# @colibri/identicon

Version 1.x follows Colibri's
[compatibility and independent release policy](https://fifo-docs.gitbook.io/colibri/getting-started/compatibility).
Compatible Core 1.x updates do not require this package to release again unless
its API or required dependency floor changes.

Deterministic Stellar account and contract identicons, written in TypeScript.
Generate the familiar SEP-33 symmetric 7×7 pattern as SVG, PNG, or a data URL,
with defaults compatible with the established Lobstr reference implementation.[^compatibility]
G-addresses follow SEP-33's account use case; C-addresses are an extended
Colibri use case that applies the same algorithm to contract ID bytes.[^contracts]

Everything is generated locally. There is no account lookup, network request,
Canvas, or DOM dependency. PNG output is a `Uint8Array`, not a Node `Buffer`.

## SVG-only rendering

For browser applications that only render SVG, use the supported subpath:

```ts
import { identiconSvg } from "@colibri/identicon/svg";

const svg = identiconSvg(
  "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO",
  { size: 224, padding: 14 },
);
```

This produces exactly the same markup and validation errors as
`new Identicon(address).toSvg(options)`, using the shared renderer without PNG
encoding dependencies. `identiconSvg` is also exported from the package root for
convenience. Use the `/svg` subpath when excluding all PNG module initialization
matters. The existing class retains its SVG, synchronous PNG and data URL
methods. The new API requires Identicon 1.1 and Core 1.1; its errors share
Core's `ColibriError` constructor across root and granular imports.

## Installation

```sh
deno add jsr:@colibri/identicon
```

For a Node or frontend bundler project, install through JSR:

```sh
npx jsr add @colibri/identicon
```

## Create an identicon

```ts
import { Identicon } from "@colibri/identicon";

const icon = new Identicon(
  "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO",
);

const svg = icon.toSvg(); // SVG markup as a string
const png = icon.toPng(); // PNG file contents as Uint8Array
const src = icon.toDataUrl({ format: "svg" }); // Ready for an image's src
```

These methods are synchronous. The constructor accepts a checksummed Stellar
Ed25519 public address (`G...`) or contract address (`C...`). Secret keys and
muxed addresses are not accepted or silently converted. The account or contract
does not need to exist on any network, and the same address produces the same
icon on every network.

### Contract addresses: extended support

Use the same API for a contract address:

```ts
const contractIcon = new Identicon(
  "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA",
);

const contractSvg = contractIcon.toSvg();
const contractPng = contractIcon.toPng();
```

SEP-33 specifies G-address identicons, not C-address identicons. Colibri's
extension decodes the 32-byte contract ID and applies the identical byte
selection, hue and mirrored-grid algorithm. There is no extra hash, type marker,
Wasm download or contract inspection. The icon represents the contract address,
not its code, and existing G-address output remains unchanged.[^contracts]

To save the results in Deno:

```ts
await Deno.writeTextFile("account.svg", svg);
await Deno.writeFile("account.png", png);
```

Writing files requires `--allow-write`; generating images itself requires no
filesystem or network permissions. In a browser, assign a data URL to an image's
`src` instead. A site's Content Security Policy must permit `data:` images for
that usage.

## Presentation options

Both renderers accept the same options. `toDataUrl` adds a required `format`.

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

| Option       | Default         | Meaning                                                                          |
| ------------ | --------------- | -------------------------------------------------------------------------------- |
| `size`       | `210`           | Final square width and height, in pixels; integer from 7 to 4096.                |
| `padding`    | `0`             | Equal integer inset on each edge; must leave at least seven pixels for the grid. |
| `background` | `"transparent"` | Transparent, or an opaque six-digit `#RRGGBB` color.                             |
| `saturation` | `0.7`           | HSV saturation, from 0 to 1.                                                     |
| `value`      | `0.8`           | HSV brightness, from 0 to 1.                                                     |

The grid and hue always come from the address. Changing saturation or brightness
is an explicit presentation override, not a different identity algorithm. There
is no automatic light/dark theme selection. Options do not mutate the icon, its
default color, or the caller's options object.

Sizes need not be divisible by seven. Both renderers use the same rounded pixel
boundaries, so cells can differ by one pixel while remaining symmetric. The
default 210-pixel image has 30×30-pixel cells. The 4096-pixel limit bounds the
raw RGBA raster to 64 MiB; it is a rendering limit, not part of SEP-33.

## Use the underlying data

Use the class's `matrix` and `color` getters, or the pure generator when you are
building a custom renderer:

```ts
import { generateIdenticon } from "@colibri/identicon";

const data = generateIdenticon(
  "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO",
);

console.log(data.color); // { r: 204, g: 98, b: 61 }
console.log(data.matrix[0]); // [true, true, true, false, true, true, true]
```

The result contains `publicKey`, `hue`, `color`, and `matrix`. For
compatibility, the existing `publicKey` property (including the class getter)
retains its name and returns the original G-address or C-address; a contract ID
is not a public key. Matrix indexing is `matrix[row][column]`, and `true` means
a filled foreground cell. The result, color, matrix, and each row are frozen and
readonly. They can be reused safely without one renderer changing the next
renderer's input.

## Typed errors

Failures use `IdenticonError`, which extends Colibri's shared error model. Each
validation has a distinct `IdenticonCode`, such as `INVALID_PUBLIC_KEY`,
`INVALID_SIZE`, `INSUFFICIENT_DRAWING_AREA`, or `INVALID_BACKGROUND`.

```ts
import { Identicon, IdenticonCode, IdenticonError } from "@colibri/identicon";

try {
  new Identicon("not-a-stellar-address");
} catch (error) {
  if (
    error instanceof IdenticonError &&
    error.code === IdenticonCode.INVALID_PUBLIC_KEY
  ) {
    console.error("Please provide a valid Stellar G-address or C-address.");
  } else {
    throw error;
  }
}
```

Invalid address input is deliberately not copied into error metadata: a user
might accidentally paste a secret key. PNG encoder failures retain their
original cause in `error.meta?.cause`.

## Identity and compatibility

An identicon is a visual aid, **not proof of account/contract ownership or an
address checksum**. Different valid addresses can share the same icon. Always
verify the complete destination address and its type for payments and other
sensitive actions.

Compatibility means the same default pattern, color, and decoded image pixels;
PNG compression and SVG markup are not required to match another encoder's file
bytes. Custom presentation options intentionally change those rendered pixels.

[^compatibility]: Colibri preserves the longstanding
    [Lobstr reference implementation](https://github.com/Lobstrco/stellar-identicon-js/blob/055bc1c5fa095e6d730ac83ec829a9278ab25cc2/index.js#L41)
    to retain compatibility with existing ecosystem identicons. That
    implementation slices bytes `[2, 16)` from the complete Base32-decoded
    StrKey, which includes its version byte. The equivalent slice of the
    already-decoded 32-byte public key is `[1, 15)`. The literal
    [SEP-33 algorithm](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0033.md)
    instead uses `[2, 16)` on the raw public key, shifting the selected bytes by
    one and producing different icons. Colibri intentionally follows the
    established implementation, rather than introducing that visual change.

[^contracts]: C-address support is a Colibri extension, not an active C-address
    identicon standard. Until an ecosystem standard is defined for these
    addresses, Colibri deliberately reuses the account algorithm. Accidental
    matches between unrelated addresses are unlikely in individual comparisons,
    but the icon uses only eight hue bits and 28 pattern bits, not all 256
    payload bits. Identical G/C payloads always produce identical icons, and
    different payloads can collide too. We consider this suitable for a visual
    aid, never as a substitute for checking the full address and its type.
