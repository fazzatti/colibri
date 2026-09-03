# Identicon compatibility fixtures

Captured: 2026-09-03

These repository-only fixtures are not published.

- `vectors.json` contains the PNG bytes from the two public examples linked in
  SEP-33, their URLs and SHA-256 digests. Matrix and RGB values were sampled
  independently from those PNGs with Pillow at each 30×30 cell's center.
- `hues` contains all 256 default RGB values, independently calculated with
  Python's `colorsys.hsv_to_rgb(byte / 255, 0.7, 0.8)`, rounding each channel
  with `floor(channel * 255 + 0.5)`.
- Tests use these pinned bytes offline; they never fetch the public service.
- The rasterization tests use resvg as an independent real SVG renderer. It is a
  root test dependency, not a dependency of the published package.

The reference generator is pinned at
[Lobstr JS 055bc1c](https://github.com/Lobstrco/stellar-identicon-js/blob/055bc1c5fa095e6d730ac83ec829a9278ab25cc2/index.js).
The implementation is independently written; no reference library source is
vendored. PNG compatibility compares decoded pixels, not compressed file bytes.
