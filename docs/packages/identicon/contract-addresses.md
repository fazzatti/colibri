# Contract address identicons

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

[^contracts]: Until an ecosystem standard defines C-address identicons, Colibri
    deliberately applies the same algorithm as for G-addresses. Accidental image
    matches between unrelated addresses are unlikely in individual comparisons,
    but the image uses only eight hue bits and 28 pattern bits rather than the
    full payload. Equal G/C payloads always produce the same icon; different
    payloads can also collide. This tradeoff is suitable for visual recognition,
    not identity verification or authorization.

[Package overview](../identicon.md)
