# @colibri/build-verification

Reproducible build verification for Stellar smart contracts.

The package resolves a target contract Wasm, reads its build metadata, resolves
the exact source and OCI image, rebuilds the contract in a bounded disposable
Docker container, selects the resulting artifact without guessing, and compares
the raw Wasm bytes. It supports strict
[SEP-58](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0058.md)
verification and an explicitly labeled out-of-band mode for older contracts.

## Installation

```sh
deno add jsr:@colibri/build-verification jsr:@colibri/core
```

The built-in runner requires a reachable Docker daemon. A custom
`ContractBuildRunner` can replace Docker when another disposable execution
environment is required.

## Public entrypoints

- `@colibri/build-verification` exports the complete verifier, pipeline,
  providers, policies, reporting tools, and domain types.
- `@colibri/build-verification/core` exports deterministic parsing, recipe,
  policy, evidence, comparison, and error APIs. Its import graph does not load
  RPC, HTTP, filesystem, Docker, verifier, or CLI adapters.
- `@colibri/build-verification/docker` exports the Docker execution boundary and
  its supporting types and errors.
- `@colibri/build-verification/cli` is both an importable CLI API and a runnable
  JSR entrypoint.

## Strict SEP-58 verification

```ts
import { ContractBuildVerifier } from "@colibri/build-verification";
import { NetworkConfig } from "@colibri/core";

const verifier = new ContractBuildVerifier({
  network: { networkConfig: NetworkConfig.MainNet() },
});

const result = await verifier.verify({
  target: { contractId: "C..." },
});

switch (result.status) {
  case "verified":
    console.log("Exact build reproduced", result.evidence);
    break;
  case "mismatch":
    console.log("The rebuilt Wasm differs", result.evidence);
    break;
  case "notApplicable":
    console.log("Build verification does not apply", result.reason);
    break;
}
```

Strict mode is the default. The target Wasm metadata is authoritative:

- `bldimg` must identify one fully qualified, SHA-256 digest-pinned,
  single-platform image manifest.
- ordered `bldarg` values are replayed, defaulting to `contract`, `build` only
  when they are absent.
- `bldopt` values remain structured arguments and are never concatenated into a
  shell command.
- `source_sha256` must match the exact downloaded or supplied archive bytes.
- non-generated contract metadata is replayed because metadata contributes to
  the final Wasm bytes.
- artifact selection considers only new or changed Cargo release Wasm files and
  fails if selecting one would require guessing.

When strict metadata contains `source_uri`, the default source provider can
retrieve it. A caller may instead provide the exact archive explicitly:

```ts
await verifier.verify({
  target: { wasmHash: "0123..." },
  source: { type: "path", path: "./contract-source.tar.gz" },
});
```

## Targets and network configuration

Targets accept direct bytes, a deployed Wasm hash, or a contract ID:

```ts
{ target: { wasm: deployedWasm, label: "local fixture" } }
{ target: { wasmHash: "0123..." } }
{ target: { contractId: "C..." } }
```

Direct Wasm does not require a network. A Wasm hash or contract ID requires one
of these mutually exclusive network paths:

```ts
import { NetworkConfig } from "@colibri/core";

new ContractBuildVerifier({
  network: { networkConfig: NetworkConfig.TestNet() },
});

new ContractBuildVerifier({
  network: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
});

new ContractBuildVerifier({
  network: {
    rpc: existingRpcLedgerEntriesClient,
    networkPassphrase,
  },
});
```

The first form keeps Colibri's existing `NetworkConfig` convenience. The other
forms allow granular configuration or an existing Core-compatible RPC reader.

## Source inputs

The default source provider accepts all of the following:

```ts
// Exact in-memory archive bytes.
{ type: "archive", name: "source.tar.gz", bytes }

// Local archive, or a directory in out-of-band mode only.
{ type: "path", path: "./source.tar.gz" }

// Policy-checked, DNS-pinned URL retrieval.
{ type: "url", url: "https://example.com/source.tar.gz" }

// GitHub revision, resolved to an exact commit SHA before downloading.
{
  type: "githubArchive",
  owner: "organization",
  repository: "contract-repository",
  revision: "exact-tag-branch-or-commit",
  format: "tarGzip",
}

// One exact GitHub release asset.
{
  type: "githubReleaseAsset",
  owner: "organization",
  repository: "contract-repository",
  tag: "v1.0.0",
  asset: "source.tar.gz",
}
```

Supported archives are `.tar`, `.tar.gz`, `.tgz`, and `.zip`. Extraction rejects
absolute paths, parent traversal, links, special entries, duplicate or
conflicting paths, ambiguous top-level roots, corrupt ZIP entries, and resource
limit violations.

Pass `githubToken` to the verifier for private or rate-limited GitHub API
requests. The default provider sends that token only to `api.github.com`, drops
it before cross-host downloads or redirects, and never places it in evidence or
logs.

## Out-of-band verification

Contracts without SEP-58 metadata can be rebuilt with a caller-supplied recipe:

```ts
const result = await verifier.verify({
  mode: "outOfBand",
  target: { wasm: await Deno.readFile("./deployed.wasm") },
  source: { type: "path", path: "./source" },
  recipe: {
    image: "docker.io/stellar/stellar-cli@sha256:...",
    arguments: ["contract", "build"],
    options: ["--package=my-contract"],
    sourceSha256: "0123...",
  },
});
```

Out-of-band evidence always records `recipeProvenance: "callerSupplied"`. A
matching result proves only that the supplied recipe reproduced the target
bytes. It does not prove that the deployed contract or its author committed to
that recipe.

## Pipeline architecture and plugins

`ContractBuildVerifier` is a polished facade over one composable Convee
pipeline. The verifier exposes it as `verificationPipe` and also accepts plugins
at construction time.

```text
resolve target -> parse metadata -> validate recipe -> resolve source
  -> resolve image -> execute build -> select artifact -> compare Wasm
```

Each responsibility is a standalone process with a stable step ID:

- `resolve-verification-target`
- `parse-contract-metadata`
- `validate-build-recipe`
- `resolve-source-archive`
- `resolve-build-image`
- `execute-contract-build`
- `select-build-artifact`
- `compare-contract-wasm`

The pipeline ID is `BuildVerificationPipeline`. Process outputs carry the
complete accumulated state, evidence, and bounded logs forward, so plugins can
observe or extend one intentional boundary without recreating the workflow.
Lower-level users can call the process functions directly or construct a
pipeline with `createBuildVerificationPipeline(...)` and explicit dependencies.

## Policies

The default policy set independently evaluates the image, build command, build
options, and each source request or redirect. Callers can replace only the
policy boundary they need:

```ts
import {
  ContractBuildVerifier,
  OfficialStellarImagePolicy,
} from "@colibri/build-verification";

const verifier = new ContractBuildVerifier({
  policy: {
    image: new OfficialStellarImagePolicy({
      registry: "registry.example.com",
      repository: "organization/stellar-cli",
      sourceRepository: "https://github.com/organization/stellar-cli-docker",
    }),
  },
});
```

The built-in `OfficialStellarImagePolicy` defaults to
`docker.io/stellar/stellar-cli` and its canonical source repository. It checks
the exact manifest digest and runtime contract. OCI provenance and SBOM
referrers are recorded when available, but this package does not claim that an
unverified provenance signature is valid. A digest establishes image identity,
not that the image or source code is safe.

## Build isolation and network access

Container network access is disabled by default:

```ts
const verifier = new ContractBuildVerifier({
  allowBuildNetwork: true,
});
```

Enable it only when the recorded build must download dependencies. The Docker
runner:

- pulls and re-inspects the exact approved manifest digest;
- uses a read-only root filesystem and drops all Linux capabilities;
- enables `no-new-privileges`;
- applies CPU, memory, process, timeout, archive, artifact, and log limits;
- runs as the disposable source workspace owner on POSIX hosts so build output
  remains owned and removable by the verifier;
- keeps Cargo downloads and home writes in bounded disposable tmpfs mounts;
- mounts only the disposable source workspace as writable; and
- owns execution only, leaving artifact collection and selection to separate
  boundaries.

The evidence reports which runner controls were enforced, including that the
built-in runner does not claim a hard disk limit. Containers share the host
kernel. Hosted verification should use disposable workers or VMs and
infrastructure-level isolation in addition to these local-development controls.

## Results, evidence, logs, and errors

Completed verification returns one of three statuses:

- `verified`: rebuilt and target Wasm bytes are exactly equal.
- `mismatch`: the build completed, but the raw bytes differ.
- `notApplicable`: the target is a Stellar Asset Contract, or strict mode found
  no SEP-58 metadata.

Downloads, policy decisions, metadata parsing, extraction, Docker execution,
artifact selection, and other operational failures throw unique
`BuildVerificationError` subclasses with stable `BLDV_*` codes. They are never
reported as `mismatch`.

Write completed evidence and bounded logs atomically:

```ts
import {
  writeVerificationEvidence,
  writeVerificationLogs,
} from "@colibri/build-verification";

await writeVerificationEvidence("verification.json", result);
await writeVerificationLogs("verification.jsonl", result.evidence.logs);
await writeVerificationLogs("verification.log", result.evidence.logs, {
  format: "text",
});
```

Evidence and logs retain hashes, sizes, decisions, resolved revisions, image
facts, execution capabilities, and stage events. They do not retain source
archive bytes, Wasm bytes, GitHub tokens, URL credentials, or environment
variable values.

## One-shot API

For one verification without retaining a configured instance:

```ts
import { verifyContractBuild } from "@colibri/build-verification";

const result = await verifyContractBuild(
  { target: { contractId: "C..." } },
  { network: { networkConfig: NetworkConfig.MainNet() } },
);
```

## CLI

Run the package directly from JSR:

```sh
deno run -A jsr:@colibri/build-verification/cli \
  --contract-id C... \
  --network mainnet \
  --evidence verification.json \
  --logs verification.jsonl
```

Out-of-band mode uses a JSON recipe file:

```sh
deno run -A jsr:@colibri/build-verification/cli \
  --wasm deployed.wasm \
  --source source.tar.gz \
  --recipe recipe.json \
  --allow-build-network
```

Use `--help` for every target, network, source, and reporting flag. Exit code
`0` means `verified` or `notApplicable`, `2` means `mismatch`, and `1` means
verification did not complete.

## Repository validation

The ordinary integration suite exercises the Docker runner against exact local
fixtures and resolves direct Wasm, Wasm-hash, contract-ID, upgraded-contract,
and Stellar Asset Contract targets on a disposable Quickstart ledger. Live
conformance checks are kept in a separate task because public source hosts and
Stellar networks are external dependencies:

```sh
deno task test:conformance
```

That task rebuilds an immutable public GitHub source archive, validates an exact
GitHub release asset, and deploys and verifies the Colibri fixture contract on
Testnet. It requires Docker and outbound network access. A scheduled GitHub
workflow runs the same task weekly, and it can also be dispatched manually.

The upgradeable Rust contract, source archives, compiled Wasm, and provenance
manifests used by these tests live under `_internal/build-verification/`. They
are repository-only fixtures and are not included in the JSR package. Rebuild or
byte-check them with:

```sh
deno task build:build-verification-fixtures
deno task check:build-verification-fixtures
```

## Scope

This package verifies reproducible contract builds. It does not publish SEP-55
attestations, manage a hosted build queue, operate a public verification
registry, audit source code, or claim that a reproduced build is safe.
