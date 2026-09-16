# Identicons

`@colibri/identicon` generates the familiar symmetric SEP-33 account image
locally. It accepts Stellar Ed25519 G-addresses and extends the same algorithm
to C-address contract IDs. Pattern and color are derived without querying a
server. An address produces the same result on every network, including when the
account has never been funded or the contract has not been deployed.

## Installation and rendering

Create SVG, PNG or data URLs with a local `Identicon` instance. Start with
[installation and rendering](identicon/rendering.md#installation-and-rendering)
for a complete script.

## Contract addresses: Colibri extension

C-addresses use the same pattern and color algorithm as G-addresses. Read
[contract address identicons](identicon/contract-addresses.md) for an example
and the boundaries of this Colibri extension to SEP-33.

## Explicit presentation

Choose size, padding, background and monochrome rendering explicitly. See
[presentation controls](identicon/rendering.md#explicit-presentation).

## Custom renderers

Use `generateIdenticon` to access the immutable cell matrix and color for your
own renderer. See [custom renderers](identicon/custom-renderers.md).

## Errors and compatibility

Handle `IdenticonError` by code and understand the reference algorithm's byte
offset. See [errors and compatibility](identicon/errors-and-compatibility.md)
and the [API reference](https://jsr.io/@colibri/identicon/doc).
