# Sources and build recipes

[Contract Build Verification overview](../build-verification.md)

## Source inputs

Callers may provide:

- exact archive bytes already available to their application;
- a local archive;
- a local directory in out-of-band mode;
- a policy-checked URL;
- a GitHub revision resolved to an exact commit; or
- an exact GitHub release asset.

The default extractor supports `.tar`, `.tar.gz`, `.tgz`, and `.zip`. It rejects
traversal, links, special files, duplicate or conflicting entries, ambiguous
roots, corrupt ZIP data, and configured
[resource-limit](policies.md#resource-limits) violations.

## Exact input shapes

These are independent source selections; choose the one matching the material
your application already has:

```ts
const sources = [
  // Bytes already read, downloaded, or received by your application.
  { type: "archive", name: "source.tar.gz", bytes },

  // A local archive; a directory is supported only out of band.
  { type: "path", path: "./source.tar.gz" },

  // A remote archive subject to the retrieval policy.
  { type: "url", url: "https://example.com/source.tar.gz" },

  // A revision resolved to an exact commit before downloading.
  {
    type: "githubArchive",
    owner: "stellar",
    repository: "soroban-examples",
    revision: commit,
  },

  // One named asset from a GitHub release.
  {
    type: "githubReleaseAsset",
    owner,
    repository,
    tag,
    asset: "source.tar.gz",
  },
];
```

The objects above illustrate shapes, not one runnable script. `bytes` is a
`Uint8Array`; `commit`, `owner`, `repository`, and `tag` are application inputs.
For `archive`, the library knows the bytes and your label, not where you
obtained them. An optional `format` is `tar`, `tarGzip`, or `zip`. GitHub
archive format is `tarGzip` or `zip`.

Strict mode hashes the **archive bytes**, not the extracted file tree, and
checks the target's `source_sha256`. Archives with identical files can have
different hashes due to ordering, compression, timestamps, or packaging.
Supplying another source does not bypass the target's committed source hash.

Prefer immutable commits and exact release assets. A branch/tag name is resolved
for a run, but may point elsewhere on a later run; inspect `requestedRevision`
and `resolvedRevision` in evidence. Tokens belong in `githubToken` or the
[CLI’s token-environment option](cli.md#flag-reference), not source URLs or
committed recipes.

## Out-of-band recipes

For private direct URLs, configure
[download headers](#authenticated-url-downloads). For a custom source provider,
see [provider composition](architecture.md#compose-a-source-provider).

```typescript
await verifier.verify({
  mode: "outOfBand",
  target: { wasm: await Deno.readFile("deployed.wasm") },
  source: { type: "path", path: "./source" },
  recipe: {
    image: "docker.io/stellar/stellar-cli@sha256:...",
    options: ["--package=my-contract"],
  },
});
```

The resulting evidence identifies the recipe as caller-supplied. It does not
claim that the target or its author committed to that recipe.

## Recipe semantics

An out-of-band recipe requires `image` and optionally provides ordered
`arguments`, `options`, metadata `{ key, value }[]`, and `sourceSha256`.
Arguments and options are arrays of complete command arguments, not a shell
command string. Preserve their order and repeated values when reproducing a
build. The image must satisfy the selected image policy, including digest
pinning.

The default build command and option policies deliberately constrain execution.
Allowing a network or a custom image does not disable the other policies. If
your recipe is rejected, inspect its policy decision instead of silently
changing the recipe until some build passes. See [policies](policies.md).

## Authenticated URL downloads

[`ContractBuildVerifier`](../build-verification.md) accepts `urlHeaders` for
direct `{ type: "url", url }` source downloads. These headers are separate from
`githubToken`, which applies to the GitHub source variants. The default provider
also uses URL retrieval for a source discovered from strict-mode metadata.

This script verifies a caller-supplied target Wasm against its committed
[SEP-58 recipe](targets.md). Supply the exact source archive URL and target
file; set `SOURCE_TOKEN` in your environment. After
[installation](../build-verification.md), save it as `verify-source.ts` and run
`deno run -A verify-source.ts https://source.example.com/source.tar.gz target.wasm`.
Replace the example URL with your service. The default runner needs
[Docker and host permissions](cli.md#machine-readable-use).

<!-- deno-check -->

```ts
import { ContractBuildVerifier } from "@colibri/build-verification";

const [url, targetPath] = Deno.args;
const token = Deno.env.get("SOURCE_TOKEN");
if (!url || !targetPath || !token) {
  throw new Error("Supply a URL, target Wasm path and SOURCE_TOKEN");
}
const verifier = new ContractBuildVerifier({
  urlHeaders: { Authorization: `Bearer ${token}` },
});
const result = await verifier.verify({
  target: { wasm: await Deno.readFile(targetPath) },
  source: { type: "url", url },
});
console.log(result.status);
```

The [retrieval policy](policies.md) still validates every destination. On a
cross-origin redirect, recognized credential headers such as `Authorization`,
`Cookie` and `X-Api-Key` are removed permanently for that retrieval, even if a
later redirect returns to the original origin. Detection uses header names; it
cannot recognize a secret placed in an arbitrary custom header. Use a direct
authenticated endpoint when the destination requires those credentials. Headers
do not bypass the committed source hash or enable
[build-container networking](policies.md#host-downloads-versus-build-network).
Keep a verifier's headers scoped to the source service they belong to; do not
reuse that credential configuration for unrelated URLs.

See the
[option reference](https://jsr.io/@colibri/build-verification/doc/~/ContractBuildVerifierOptions)
for custom transports and provider configuration.
