# Consumer compatibility checks

Run `deno task check:consumers` with Deno 2.7.11, Node >=22.12, and npm
available. `STELLAR_SDK_VERSION` optionally selects a version/range; the default
is 17.0.1. CI checks the minimum on Node 22.12 and the supported `^17.0.1` range
on Node 24.

The check uses a disposable directory outside the repository:

1. Copies package source without tests, `_internal`, `_tools`, or node_modules.
   Retains member aliases and external dependency settings, but removes the root
   workspace's local Colibri import redirects.
2. Checks every declared entrypoint and executes a native SDK consumer in Deno.
3. Uses pinned `@deno/dnt` to create ESM/declaration test artifacts for Core,
   Identicon, WebAuth, RPC Streamer, and both plugins. No runtime shims are
   added.
4. Packs and installs those artifacts into a separate npm consumer. Checks its
   TypeScript against installed declarations and executes it in Node.
5. Bundles that consumer for browsers using esbuild without Node polyfills.

The smoke consumer supplies its own Stellar SDK `Operation`, `Transaction`,
`Spec`, and `Server`. It verifies a real signature using the SDK, checks
callable pipelines and native object identity, and generates PNG/SVG identicons.

Build Verification and Test Tooling retain Deno/Docker integration checks in
their normal package jobs; this check does not claim they run in a browser or
Node. Browser bundling is not a full browser runtime test.

These are test-only npm artifacts. They are never uploaded or published, and
they are not byte-identical copies of JSR's registry-generated npm tarballs.
`deno publish --dry-run` remains the JSR publishing-boundary check. A check of
the actual newly released JSR distribution must occur after publication.

New workspace members enter Deno validation through their manifests. Update the
explicit browser-capable classification when introducing a runtime-specific
package; do not infer browser support from successful Deno type checking.
