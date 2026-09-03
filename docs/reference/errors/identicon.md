# identicon

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code         | Condition                                                                           | Source                                                                                       |
| ------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `IDICON_001` | `INVALID_PUBLIC_KEY` — Input is not a valid checksummed Ed25519 G-address.          | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L6)  |
| `IDICON_002` | `INVALID_OPTIONS` — Render options are not an object.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L8)  |
| `IDICON_003` | `INVALID_SIZE` — Size is not an integer in the supported range.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L10) |
| `IDICON_004` | `INVALID_PADDING` — Padding is not a nonnegative integer.                           | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L12) |
| `IDICON_005` | `INSUFFICIENT_DRAWING_AREA` — Padding leaves insufficient room for the grid.        | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L14) |
| `IDICON_006` | `INVALID_SATURATION` — Saturation is not a finite value between zero and one.       | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L16) |
| `IDICON_007` | `INVALID_VALUE` — Brightness is not a finite value between zero and one.            | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L18) |
| `IDICON_008` | `INVALID_BACKGROUND` — Background is neither transparent nor a six-digit hex color. | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L20) |
| `IDICON_009` | `INVALID_FORMAT` — Data URL format is neither svg nor png.                          | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L22) |
| `IDICON_010` | `PNG_ENCODING_FAILED` — The PNG encoder rejected image data.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/identicon/src/error/index.ts#L24) |
