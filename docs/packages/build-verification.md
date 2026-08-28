# Contract Build Verification

`@colibri/build-verification` rebuilds Stellar contract source inside an exact,
digest-pinned image and compares the rebuilt Wasm bytes with a local or deployed
target.

It supports strict
[SEP-58](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0058.md)
metadata-driven verification and a clearly labeled out-of-band path for older
contracts.

## Install

```bash
deno add jsr:@colibri/build-verification jsr:@colibri/core
```

The default runner requires a reachable Docker daemon.

## Verify a deployed contract

```typescript
import { ContractBuildVerifier } from "@colibri/build-verification";
import { NetworkConfig } from "@colibri/core";

const verifier = new ContractBuildVerifier({
  network: { networkConfig: NetworkConfig.MainNet() },
});

const result = await verifier.verify({
  target: { contractId: "C..." },
});
```

Strict mode uses the contract's own `bldimg`, ordered `bldarg`, `bldopt`,
`source_uri`, and `source_sha256` metadata. The exact source archive is hashed
before safe extraction, and the rebuilt Wasm is selected without guessing.

Direct Wasm targets need no network. Contract IDs and Wasm hashes accept either
a Colibri network configuration, an existing compatible RPC reader plus a
passphrase, or an RPC URL plus a passphrase:

```typescript
new ContractBuildVerifier({
  network: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
});
```

## Interpret the result

```typescript
switch (result.status) {
  case "verified":
    console.log(result.evidence);
    break;
  case "mismatch":
    console.log(result.evidence.artifact?.sha256);
    break;
  case "notApplicable":
    console.log(result.reason);
}
```

Operational failures throw typed Colibri errors with stable `BLDV_*` codes.
`mismatch` is returned only after a build completes and raw-byte comparison is
possible.

## Source inputs

Callers may provide:

- exact in-memory archive bytes;
- a local archive;
- a local directory in out-of-band mode;
- a policy-checked URL;
- a GitHub revision resolved to an exact commit; or
- an exact GitHub release asset.

The default extractor supports `.tar`, `.tar.gz`, `.tgz`, and `.zip`. It rejects
traversal, links, special files, duplicate or conflicting entries, ambiguous
roots, corrupt ZIP data, and configured resource-limit violations.

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

## Pipeline architecture

The high-level verifier delegates to a composable `BuildVerificationPipeline`
and exposes it as `verificationPipe`:

```text
resolve target -> parse metadata -> validate recipe -> resolve source
  -> resolve image -> execute build -> select artifact -> compare Wasm
```

Each process has a thin Convee step and a stable ID. Plugins can target one
intentional step, while lower-level consumers may call a process directly or
construct the pipeline with explicit providers and runners. Complete state,
evidence, and bounded structured logs pass through every stage.

## Security defaults

- Build-container network access is disabled unless `allowBuildNetwork: true` is
  set.
- The default image policy accepts the configured official Stellar CLI trust
  root and requires an exact single-platform manifest digest.
- Source URL policy is checked again after every redirect, and HTTP connections
  are pinned to the approved DNS results.
- Docker execution uses a read-only root filesystem, drops capabilities, and
  applies CPU, memory, PID, time, output, archive, and artifact limits.
- The runner executes only. Artifact collection and selection are separate
  boundaries.
- Evidence records provenance and SBOM observations without claiming an
  unverified signature is valid.

Use disposable workers or VMs for hosted verification of untrusted source.
Container isolation alone is intended for the local developer workflow.

## Evidence, logs, and CLI

`writeVerificationEvidence(...)` writes stable JSON.
`writeVerificationLogs(...)` writes bounded JSONL or text logs. Neither surface
retains source bytes, Wasm bytes, URL credentials, GitHub tokens, or
environment-variable values.

Run the package directly from JSR:

```bash
deno run -A jsr:@colibri/build-verification/cli \
  --contract-id C... \
  --network mainnet \
  --evidence verification.json \
  --logs verification.jsonl
```

The package also publishes `/core`, `/docker`, and `/cli` entrypoints. See the
[package README](../../build-verification/README.md) for every source variant,
the out-of-band trust boundary, custom image-policy configuration, stable step
IDs, granular RPC inputs, and CLI flags.

## Validation in this repository

The normal integration suite uses disposable Docker builds and a local
Quickstart ledger. Live open-source and Testnet checks run separately with
`deno task test:conformance` and through the scheduled Build Verification
Conformance workflow. The Rust contracts, compiled Wasm, source archives, and
manifests under `_internal/build-verification/` are test fixtures only; they are
not published with the package.
