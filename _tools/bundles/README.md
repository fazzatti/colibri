# Browser bundle regression checks

This tooling measures real minified, standalone browser consumers through public
package entrypoints. It does not change package side-effect metadata or override
Rollup's `treeshake.moduleSideEffects`. See the
[consumer guide](../../docs/getting-started/browser-bundles.md).

## Run

Use Deno 2.9.6, Node 24 and npm. Browser installation needs network access and
the usual Playwright system dependencies. All npm packages built here are
temporary pre-publication test artifacts, never uploaded to a registry.

```sh
deno task prepare:consumers /tmp/colibri-consumers
deno task check:bundles /tmp/colibri-bundles /tmp/colibri-consumers
deno task test:bundle-tooling
```

The first command defaults to Stellar SDK 17.0.1. The bundle check requires that
version explicitly, rather than silently comparing a different SDK release.
Production Deno inputs use `dependencies.lock` and `--frozen-lockfile`; the
resolved SDK graph is checked for one matching instance. The reviewed fixture
covers isolated source scopes, not the repository workspace's mutable lockfile.
When deliberately changing dependencies or candidate package versions,
regenerate that fixture from the isolated source directory, review its changes,
and remeasure the baseline. Before CI prepares artifacts, `test:bundle-tooling`
checks candidate versions and resolves every actual isolated bundle entrypoint
with the pinned Deno runtime and `--frozen-lockfile`. This also catches drift in
root import-map dependencies, even when package versions are unchanged. Its
negative control removes dependency metadata and verifies that Deno rejects the
fixture without rewriting it. The full build still enforces the frozen graph.

The second bundler is Rollup 4.50.1 with browser resolution, CommonJS conversion
and Terser minification. It consumes installed npm ESM artifacts from dnt
0.43.2. Its exact plugin versions and installed lockfile are retained in the
output. Both bundlers use pinned pako 2.1.0 at gzip level 9 for measurements.
This produces the original probe's gzip sizes; Deno and Node's native zlib
implementations can produce different sizes for the same bytes at the same
compression level.

For the exact historical published Core 1.0.0 comparison:

```sh
deno run -A _tools/bundles/reproduce-published.ts /tmp/colibri-published
```

That command uses a separate frozen dependency fixture and verifies all five raw
sizes, gzip sizes and SHA-256 hashes. Two probes deliberately reproduce internal
URL imports as diagnostics. Those URLs are not supported consumer APIs, and
published Core 1.0.0 has only a root entrypoint.

## What fails the checks

- Raw or compressed size exceeds a consumer's budget in `fixtures.ts`.
- The errors entrypoint retains Stellar, contract, RPC or compression code.
- StrKey or SVG subpaths retain transaction, contract, RPC, XDR or PNG encoders.
  Stellar key/checksum and base32 helpers are expected in these consumers.
- A standalone output still imports another module.
- Root and granular constructors differ, validation changes, SVG rendering
  differs, PNG rendering fails, or a bundle fails to execute in Chromium,
  Firefox or WebKit.

The root SVG re-export is measured separately: some unused PNG initialization
still survives through that barrel. Only the dedicated SVG subpath promises this
isolation. The existing Identicon class keeps all its synchronous render
methods.

Deno retention is derived from source-map segments, not the list of source
files. Rollup retention uses each output module's nonzero `renderedLength`,
before final Terser minification. The latter is a conservative indication; a
module may be further reduced by minification. Both reports keep visited and
retained lists separate. Neither approach assigns compressed byte counts to
individual modules.

CI runs these checks in the pinned SDK browser job and uploads the measurements,
resolved locks, warnings, JavaScript, source maps and browser results. The
existing v1 consumer fixtures remain separate and unchanged; they exercise
native SDK objects, cryptography, transactions, signer extensions and plugins.
Package unit tests cover SVG parity across all 256 hues, G/C addresses, options
and structured failures. Architecture checks keep all 365 literal registry keys
aligned with their original enum-member types and values.

The value probes distinguish direct namespace imports (`value-symbol`) from a
forwarded named namespace (`value-namespace`). Deno 2.9.6 retains the latter as
a whole object; use `import * as SorobanType from "@colibri/core/values"` when
individual-codec tree shaking matters. Static alias annotations cover only reads
of owned readonly fields. The original symbol budget stays unchanged, and the
forwarded form has its own explicit budget and browser/dependency checks.

## React and pipeline probes

The React probes cover provider/connection, pure query utilities, standalone
contract reads, generated-client invocation adapters, Classic pipelines, assets,
WebAuth and SVG identicons. Light probes reject retained SDK XDR, pipelines and
unrelated package code. Read probes reject signer/send/invoke-pipeline code. The
invocation adapter probe excludes the caller's generated client and its
pipeline; it is not the total cost of an invoking application.

Rollup replaces `process.env.NODE_ENV` with `"production"` to select production
React. It also writes `split.json` for assets and WebAuth, alongside split
chunks: `initial` follows every static dependency of the entry, while `complete`
sums all emitted JavaScript chunks, including deferred imports. Gzip is summed
per chunk. These are measurements, separate from the existing standalone budget
gates and browser executions. Lazy loading changes timing, not total code cost.
