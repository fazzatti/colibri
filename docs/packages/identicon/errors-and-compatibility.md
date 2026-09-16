# Errors and compatibility

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

See [every identicon error](../../reference/errors/identicon.md) and the
[API reference](https://jsr.io/@colibri/identicon/doc). For browser rendering,
assign a data URL to an image's `src` and give the image meaningful alt text;
visual resemblance is not an authentication check.

[Package overview](../identicon.md)
