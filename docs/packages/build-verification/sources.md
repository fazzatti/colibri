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
roots, corrupt ZIP data, and configured resource-limit violations.

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
and `resolvedRevision` in evidence. Tokens belong in `githubToken` or the CLI's
token-environment option, not source URLs or committed recipes.

## Out-of-band recipes

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
