# Browser tree-shaking investigation

Verified 2026-09-09. The unchanged branch baseline is
`6420eaed9d33bf0ff3265183852f3b7992afdea2`. Measurements below use Stellar SDK
17.0.1 and Deno 2.9.6. Raw bytes include minification; gzip uses level 9 with
pako 2.1.0, verified to reproduce the original Python/zlib sizes. Complete
summary data and browser versions are in [measurements.json](measurements.json).
[The runner](README.md) explains reproduction, locks and CI artifacts.

## Published Core 1.0.0: exact reproduction

All five byte counts and SHA-256 hashes match the supplied investigation. The
portable historical fixture also reproduces them with a frozen lockfile.

| Consumer                                | Raw bytes | Gzip bytes |
| --------------------------------------- | --------: | ---------: |
| Unused Core root import                 | 1,021,724 |    222,281 |
| Root ColibriError                       | 1,021,720 |    222,280 |
| Internal error module, diagnostic only  |     1,013 |        440 |
| Root StrKey                             | 1,021,714 |    222,277 |
| Internal StrKey module, diagnostic only |    16,149 |      5,921 |

The internal URLs are confined to the historical diagnostic fixture. Core 1.0.0
only exposes its root as a supported entrypoint.

## Current branch: before and after

The source comparison uses isolated current-package scopes with the same SDK.
The new public entrypoints replace the unsupported leaf-import experiments.

| Consumer                     | Before raw | Before gzip | After raw | After gzip |
| ---------------------------- | ---------: | ----------: | --------: | ---------: |
| Unused Core root             |  1,032,444 |     225,554 |   970,688 |    211,357 |
| Root ColibriError            |  1,032,440 |     225,553 |   970,684 |    211,360 |
| Root StrKey                  |  1,032,434 |     225,549 |   970,678 |    211,355 |
| Identicon class, toSvg       |  1,055,385 |     234,139 |    36,234 |     13,685 |
| Core /errors                 |          — |           — |     1,013 |        440 |
| Core /strkey                 |          — |           — |    16,149 |      5,921 |
| Identicon /svg               |          — |           — |    16,853 |      6,770 |
| Identicon root, identiconSvg |          — |           — |    18,169 |      7,176 |

Small differences in root minification also depend on the source probe's symbol
names. The checked-in probes provide stable inputs for subsequent comparisons.

## Confirmed causes and changes

1. **The broad root reaches observable initialization.** Decorator application,
   enum-key property access and standard construction prevent otherwise-unused
   dependencies from being discarded. The new `/errors` and `/strkey` exports
   directly re-export existing implementations without traversing that root.
   Constructor identity and `instanceof` are checked in source and installed
   browser consumers.
2. **Error registry keys cost runtime property reads.** All 365 concrete Core
   registry keys now use literal strings with erased enum-member assertions,
   such as `["BTX_000" as Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR`. The actual
   existing member names are preserved. Plain literal keys would change inferred
   `keyof` types; the assertions preserve those types. A syntax check verifies
   the literal against its enum value, and a consumer test checks enum
   assignability.
3. **The XDR namespace spread adds retention.** It now names the same four
   `authEntries` members explicitly, preserving their identities and order.
4. **The Identicon class couples SVG and PNG methods.** Its implementation and
   synchronous methods remain intact. The new `identiconSvg` function shares the
   existing generator, validation, geometry and renderer. The `/svg` entrypoint
   never imports PNG encoding. Identicon's error module now consumes Core's
   lightweight public error entrypoint, eliminating its previous broad Core
   edge.

Controlled current-source experiments confirm the root contributors. With the
other production changes retained, restoring enum lookups gives 224,585 gzip
bytes; restoring the namespace spread gives 212,291. Disabling all 24 decorators
in a disposable copy gives 106,457. These are separate experiments, not additive
savings. The decorator-disabled copy changes behavior and is not shipped.

Mapped output still contains built-in contract standards and native XDR, RPC and
transaction code in root consumers. Standards construct XDR and normalize
interfaces at module evaluation; memoized asset/parser classes retain related
code. Their initialization and caching behavior are unchanged. No blanket
side-effect declaration, decorator removal, standard stub or new purity
annotation is used in production.

## Independent bundler comparison

Rollup 4.50.1 uses browser module resolution, CommonJS conversion, Terser and
standalone ESM output, consuming installed dnt 0.43.2 npm test artifacts. This
also exercises the distribution boundary; its numbers are not a pure comparison
of minifiers against identical emitted input.

| Consumer               |   Deno raw / gzip | Rollup raw / gzip |
| ---------------------- | ----------------: | ----------------: |
| Root ColibriError      | 970,684 / 211,360 | 830,616 / 180,005 |
| Core /errors           |       1,013 / 440 |       1,294 / 600 |
| Core /strkey           |    16,149 / 5,921 |    14,836 / 5,340 |
| Identicon class, toSvg |   36,234 / 13,685 |   34,885 / 12,967 |
| Identicon /svg         |    16,853 / 6,770 |    16,132 / 6,378 |

Both granular SVG bundles exclude `fast-png` and `fflate`. Error-only bundles
exclude the Stellar SDK entirely. StrKey and SVG retain the SDK's key/checksum
implementation and base32 helpers, without XDR, contract, RPC or transaction
code. Root SVG re-exports still retain some PNG module initialization in both
builds; use `/svg` for dependency isolation.

Deno's source-map mappings and Rollup's nonzero module `renderedLength`
determine retention. Merely visiting a module is not counted as retaining it.
Reports retain both inventories. Rollup's count is conservative because Terser
can further reduce its output.

## Spec boundary and behavior verification

Core now exports the exact native `Spec` constructor, including static helpers,
and the native `Result` type. Contract, event and error-extraction APIs consume
that shared type. SDK-created instances remain compatible without conversion.
Generated files import these through Core, and generated JSR/npm manifests have
only Core as a runtime dependency. The generator itself still uses SDK XDR/RPC
internally. A real generated npm package installs, builds, executes and packs
with only the pre-publication Core artifact substituted for its normal JSR
alias.

Validation completed:

- 246 workspace unit suites / 2,752 steps, including existing caching, parser,
  error and standard behavior. CRAP gate 15 passed across 1,515 functions.
- New source consumers and generated type fixtures pass on Deno 2.7.11 and
  2.9.6.
- SVG equality across every hue, G/C addresses, reference vectors and theme/
  geometry options; structured validation errors and validation order match.
- Nine production consumers per bundler execute in Chromium 149, Firefox 151 and
  WebKit 26.5: 54 executions, including shared constructors and PNG rendering.
- Preserved v1 native SDK, transaction, signing and plugin consumers pass in all
  three engines. npm consumers pass with TypeScript 5.9.3 and 6.0.3.
- Architecture, lint, public types, JSR documentation, package dry run,
  release/API checks and 49 complete documentation examples pass. The previous
  nine binding-surface documentation diagnostics are resolved.

## Remaining limits

The full root is still large. Consumers seeking a small error or key helper
should use the supported subpaths. The SVG function's root re-export does not
promise complete PNG dependency isolation. JSR's actual published npm package
for Core/Identicon 1.1 is not available yet; npm validation uses explicit dnt
test artifacts and is not presented as JSR's own tarball.

The exact published reproduction still emits upstream `ignored-bare-import`
warnings. Stellar SDK 17.0.1's `sideEffects` list marks only its ESM/CJS
`base/scval.js` files; Deno warns when it drops bare imports of other SDK
modules, notably the XDR barrel. That metadata was inspected and left unchanged.
The current isolated Deno graph did not emit those warnings. Rollup reports
generated decorator helpers' top-level `this` rewrites and existing
Core/smol-toml cycles. Warnings remain captured; passing these consumers is not
a universal audit of all upstream initialization assumptions.

No Vanity-specific fonts, redundant contract metadata or SDK source was changed.
Its 171 composite SVG fixtures are separate from Colibri's renderer parity suite
and were not rerun here. No release is published or PR merged by these checks.
