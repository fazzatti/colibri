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

Targets accept direct bytes, a deployed Wasm hash, a contract ID, or a CAP-85
external executable reference:

```ts
{ target: { wasm: deployedWasm, label: "local fixture" } }
{ target: { wasmHash: "0123..." } }
{ target: { contractId: "C..." } }
{ target: { externalRef: { owner: "COWNER...", tag: "stable" } } }
```

Contract IDs are inspected automatically: ordinary Wasm instances resolve their
direct hash, Stellar Asset Contracts return `notApplicable`, and CAP-85
instances follow their external reference. A direct external-reference target
allows verification without first deploying an instance.

Direct Wasm does not require a network. A Wasm hash, contract ID, or external
reference requires one of these mutually exclusive network paths:

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

External-reference evidence records the owner, the exact tag bytes as base64,
the resolved Wasm hash, and the ledgers at which the instance, reference, and
code entries were observed. A verified result proves that the Wasm selected by
that mapping at the recorded observation rebuilt exactly. It does not claim that
the owner/tag mapping is immutable; rerun verification to observe later changes.

## Source inputs

The default source provider accepts all of the following:

```ts
// Archive bytes already available to the caller as a Uint8Array.
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

The `archive` form accepts bytes acquired by the caller and does not infer how
they were transported. Colibri copies and hashes those exact bytes. In strict
SEP-58 verification, their hash must match the `source_sha256` committed in the
target contract metadata.

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
options, and each source request or redirect. Image policies first evaluate the
digest-pinned reference before any registry request, then evaluate the resolved
manifest and runtime facts. Callers can replace only the policy boundary they
need:

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
the registry, repository, and requested digest before registry I/O, followed by
the exact resolved manifest digest and runtime contract. Registry requests,
redirect destinations, and bearer-token endpoints are DNS-pinned and evaluated
by the source-retrieval policy before transport I/O. OCI provenance and SBOM
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
- streams and bounds stdout and stderr before retaining them in host memory,
  while disabling Docker daemon log persistence for the build container;
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

Build containers receive a descriptive, unique name using the
`colibri-build-verification-<unique-id>` pattern. A caller can replace only the
prefix when several applications share one Docker daemon:

```ts
const verifier = new ContractBuildVerifier({
  docker: { containerNamePrefix: "my-contract-verifier" },
});
```

The runner still appends a unique ID to every container and removes it after the
build; a custom prefix never turns a build container into a reusable one.

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

Version `0.3.0` replaces the former catch-all `INVALID_CLI_ARGUMENTS`
(`BLDV_031`) code with occurrence-specific CLI errors in the `BLDV_106` through
`BLDV_131` range. This is an intentional pre-1.0 breaking change: integrations
must branch on the precise new error code instead of treating
`CLI_POSITIONAL_ARGUMENT_UNSUPPORTED` or any other single code as a one-to-one
replacement.

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
facts, execution capabilities, and stage events. Structured evidence omits raw
source/Wasm bytes and sensitive retrieval credentials. Captured build stdout and
stderr can still contain anything printed by a build script; review them before
publishing or forwarding logs.

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
deno run -A jsr:@colibri/build-verification@0.4.2/cli \
  --contract-id C... \
  --network mainnet \
  --evidence verification.json \
  --logs verification.jsonl
```

Verify an external reference directly with either a UTF-8 tag or lossless base64
tag bytes:

```sh
deno run -A jsr:@colibri/build-verification@0.4.2/cli \
  --external-ref-owner COWNER... \
  --external-ref-tag stable \
  --network testnet

deno run -A jsr:@colibri/build-verification@0.4.2/cli \
  --external-ref-owner COWNER... \
  --external-ref-tag-base64 c3RhYmxl \
  --network testnet
```

The default terminal output is one concise line. Interactive terminals receive
an animated stage status on standard error without contaminating standard
output; pass `--quiet` to suppress it. Animation is disabled automatically for
`--json` and non-interactive output. `--evidence` and `--logs` retain complete
records in their requested files:

```text
VERIFIED ba789fe6627de52ebfbd5353f5eb6b7efef23d7e8633ab59051c1a22b2f00a88
```

Pass `--json` when stdout or stderr must contain the complete machine-readable
result or typed Colibri error:

```sh
deno run -A jsr:@colibri/build-verification@0.4.2/cli \
  --contract-id C... \
  --network mainnet \
  --json
```

Out-of-band mode uses a JSON recipe file:

```sh
deno run -A jsr:@colibri/build-verification@0.4.2/cli \
  --wasm deployed.wasm \
  --source source.tar.gz \
  --recipe recipe.json \
  --allow-build-network
```

Private or rate-limited GitHub sources read a token from an explicitly named
environment variable so the token never appears in process arguments:

```sh
deno run -A jsr:@colibri/build-verification@0.4.2/cli \
  --wasm deployed.wasm \
  --github-owner organization \
  --github-repository private-contract \
  --github-revision exact-commit \
  --github-token-env GITHUB_TOKEN \
  --recipe recipe.json
```

Use `--container-name-prefix my-contract-verifier` to distinguish which
application or CI job created a disposable build container. The unique suffix is
always added by Colibri.

`-A` is the shortest invocation. The default Docker runner has also been
validated without process or FFI permission using this narrower capability set:

```sh
deno run \
  --allow-read \
  --allow-write \
  --allow-net \
  --allow-env \
  --allow-sys=homedir \
  jsr:@colibri/build-verification@0.4.2/cli \
  --contract-id C... \
  --network mainnet
```

Read access covers local inputs and Docker socket discovery; write access covers
the disposable workspace and requested reports; network access covers RPC,
source, registry, and Docker endpoints; environment access is required by the
Dockerode dependency graph; and `homedir` is used to discover desktop Docker
sockets. Use path- and host-scoped permissions when the concrete inputs and
Docker endpoint are known.

An empty invocation, `-h`, or `--help` prints every target, network, source, and
reporting flag. Exit codes are intentionally unambiguous:

- `0`: the rebuilt Wasm was verified;
- `1`: verification or reporting did not complete;
- `2`: the rebuilt Wasm differs from the target; and
- `3`: verification is not applicable, including missing strict SEP-58 metadata
  or a Stellar Asset Contract target.

When verification fails after it begins, `--evidence` writes a structured
failure report containing the typed error and available partial evidence, while
`--logs` writes every bounded event accumulated before the failure. Summary mode
changes only terminal presentation, never exit behavior or report detail.

## Scope

This package verifies reproducible contract builds. It does not publish SEP-55
attestations, manage a hosted build queue, operate a public verification
registry, audit source code, or claim that a reproduced build is safe.
