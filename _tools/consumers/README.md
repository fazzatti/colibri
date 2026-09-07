# Consumer compatibility checks

These fixtures test installed/public APIs, not repository-private paths. They
are additional compatibility evidence and do not contribute package coverage.
Use Deno 2.9.6 for preparation, with a supported Node runtime and npm available.
`deno task check:consumers --browsers` runs the local source, packaging, Node,
and browser path. CI separates these tasks to reuse artifacts and run in
parallel.

| Task                                         | Evidence                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `check:consumers:deno`                       | All 14 public entrypoints and preserved consumers on Deno 2.7.11/2.9.6                                                                      |
| `prepare:consumers <directory>`              | Portable dnt ESM/declaration tarballs, prepared once per selected SDK                                                                       |
| `check:consumers:npm <directory>`            | Installed artifacts compiled with TS 5.9.3/6.0.3 and executed on Node 22.12.0, patched 22.x, or 24.x                                        |
| `check:consumers:npm <directory> --browsers` | The same consumer bundled without Node polyfills and executed in real Chromium, Firefox, and WebKit                                         |
| `check:consumers:dependencies`               | Candidate dependent packages with minimum available compatible Core release trees, and compatible historical dependents with candidate Core |
| `check:consumers:published`                  | Actual newly published JSR modules and JSR-generated npm distributions                                                                      |

`STELLAR_SDK_VERSION` selects exact `17.0.1` or a freshly resolved compatible
17.x range. Preparation records the resolved SDK in `manifest.json`; installed
lanes reuse it. `TYPESCRIPT_VERSION` selects 5.9.3 or 6.0.3 for npm consumers.
Browser engines are pinned through Playwright 1.61.0 and their actual versions
are logged. Minimum runtime lanes are compatibility fixtures, not recommended
security patch levels for applications.

## Preserved consumers

`v1/smoke.ts` verifies native `Asset`, `Operation`, `Transaction`, `Spec`, and
`Server` interoperability, real signatures, binary handling, markets,
predicates, streamers, package imports, and SVG/PNG rendering.
`v1/extensions.ts` implements a consumer-owned signer and Contract subclass,
builds and signs a real transaction through callable Colibri steps,
attaches/removes a targeted Convee plugin, and checks stable error identity/code
and fee/sequence semantics. No RPC submission or mocked protocol behavior is
involved in these offline consumers.

Do not rewrite these consumers to make a later breaking candidate pass. Add new
fixtures for newly introduced APIs; discuss intentional major changes
explicitly.

Source graphs use explicit scoped import maps with **no workspace members**.
Both the bare and `jsr:` Core aliases bind to the selected Core source, and
package-specific SDK aliases are overridden consistently. Package files are
copied into disposable directories without tests, internal fixtures, tools, or
node_modules. npm artifacts retain Core and Convee as shared dependencies; they
do not embed private copies of those runtime/type identities.

## Minimum dependency and historical checks

Fetch all release tags. For each declared Core dependency, the checker selects
the oldest available compatible Core tag (or this candidate if it is the first
compatible release). It checks the entire dependent package and executes its
public entrypoints plus the preserved Core extension consumer. It then tests the
earliest historical dependent release whose manifest accepts candidate Core.
Each graph selects its own exact source tree and original root dependency
settings, rather than silently binding everything to workspace Core.

The first 1.0 release has no prior compatible 1.x artifacts. This bootstrap is
reported explicitly; historical lanes start using `core-1.0.0` and the matching
package tags once published. Missing/failing required release trees are errors,
not a reason to silently use current source. These source-tree checks
complement, but do not replace, registry distribution checks.

## Distribution and runtime limits

dnt tarballs are CI artifacts only, never published packages. They are uploaded
as short-lived GitHub Actions artifacts for reuse, not to JSR/npm. The publish
workflow runs a separate check against real JSR modules and JSR-generated npm
tarballs after publication. To validate that tool using an already published
baseline, run `check:consumers:published --versions-from-ref origin/main`.

The npm registry check imports canonical `@jsr/colibri__…` package names to
avoid alias-induced duplicate installations. Applications using aliases should
inspect their dependency graph; JSR recommends pnpm where npm deduplication is
problematic. See [JSR npm compatibility](https://jsr.io/docs/npm-compatibility).

Build Verification and Test Tooling remain Deno/Docker packages for this support
policy. All their public entrypoints are type-checked; normal integration suites
validate Docker/network execution. Browser-capable classification is explicit in
`environment.ts`, not inferred from a successful Deno type check.
