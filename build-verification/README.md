# @colibri/build-verification

Reproducible build verification for Stellar smart contracts.

The package fetches or accepts target contract WASM, reads its build metadata,
rebuilds the recorded source inside the digest-pinned build image, and compares
the resulting bytes. It supports strict
[SEP-58](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0058.md)
verification and an explicitly labeled out-of-band mode for older contracts.

## Installation

```sh
deno add jsr:@colibri/build-verification jsr:@colibri/core
```

Docker is required by the built-in runner. The verifier can also receive a
custom `ContractBuildRunner` for another disposable execution environment.

## Strict SEP-58 verification

```ts
import { ContractBuildVerifier } from "@colibri/build-verification";
import { NetworkConfig } from "@colibri/core";

const verifier = new ContractBuildVerifier({
  network: NetworkConfig.MainNet(),
});

const result = await verifier.verify({
  target: { contractId: "C..." },
});

if (result.status === "verified") {
  console.log("Exact build reproduced", result.evidence);
} else if (result.status === "mismatch") {
  console.log("Build completed, but the WASM bytes differ", result.evidence);
} else {
  console.log("SEP-58 does not apply", result.reason);
}
```

Strict mode is the default. It treats the target WASM metadata as authoritative:

- `bldimg` must identify one fully qualified, single-platform image manifest by
  SHA-256 digest.
- ordered `bldarg` values are replayed, defaulting to `contract`, `build` only
  when they are absent.
- `bldopt` values are passed as structured arguments, never concatenated into a
  shell command.
- `source_sha256` must match the exact downloaded or supplied archive bytes.
- non-generated contract metadata is replayed because metadata is part of the
  final WASM bytes.
- artifact selection considers only new or changed Cargo release WASM files and
  fails if choosing one would require guessing.

If `source_uri` is present, Colibri downloads it. You can instead supply the
exact archive explicitly:

```ts
await verifier.verify({
  target: { wasmHash: "0123..." },
  source: { type: "path", path: "./contract-source.tar.gz" },
});
```

GitHub archive URLs also have a convenience input:

```ts
await verifier.verify({
  target: { wasm: deployedWasm },
  source: {
    type: "github",
    owner: "organization",
    repository: "contract-repository",
    ref: "exact-commit-sha",
  },
});
```

Supported source archives are `.tar`, `.tar.gz`, and `.tgz`. Extraction rejects
absolute paths, parent traversal, links and special entries, multiple top-level
directories, and configured resource-limit violations.

## Network configuration

Network-backed targets accept the normal Colibri configuration:

```ts
new ContractBuildVerifier({
  network: NetworkConfig.TestNet(),
});
```

Granular inputs and an existing RPC reader are also supported:

```ts
new ContractBuildVerifier({
  network: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
});

new ContractBuildVerifier({
  network: {
    rpc: existingRpcClient,
    networkPassphrase,
  },
});
```

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
  },
});
```

Out-of-band evidence is always labeled `recipeProvenance: "callerSupplied"`. It
proves that the supplied recipe reproduced the target bytes; it does not prove
that the recipe came from the deployed contract or its original author.

## Image policy

The default `OfficialStellarImagePolicy` accepts only
`docker.io/stellar/stellar-cli`. The image must still be digest-pinned to one
platform manifest. A tag or multi-platform index is rejected.

Use a custom policy when your organization trusts another repository:

```ts
const verifier = new ContractBuildVerifier({
  imagePolicy: {
    validate(image) {
      if (image.registry !== "registry.example.com") {
        throw new Error("untrusted registry");
      }
    },
  },
});
```

Policy failures are normalized into typed Colibri errors. A digest establishes
image identity, not that the image or source code is safe.

## Build isolation and network access

Container network access is disabled by default:

```ts
const verifier = new ContractBuildVerifier({
  allowBuildNetwork: true,
});
```

Enable it only when the recorded build must download dependencies. The Docker
runner uses a read-only root filesystem, drops Linux capabilities, enables
`no-new-privileges`, applies CPU, memory, process, time, archive, and log
limits, and gives only the source tree and disposable cache locations write
access.

Containers share the host kernel. A hosted verifier should run builds in
disposable workers or VMs and apply infrastructure-level isolation in addition
to these local-development controls.

## Results and evidence

Completed comparisons return only:

- `verified`: the rebuilt and target WASM bytes are equal.
- `mismatch`: the build completed but the bytes differ.
- `notApplicable`: the target is a Stellar Asset Contract or has no strict
  SEP-58 metadata.

Downloads, policy decisions, extraction, Docker, build, and artifact failures
throw unique `BuildVerificationError` subclasses with stable `BLDV_*` codes.
They are not presented as verification outcomes.

Write completed evidence to a file:

```ts
import { writeVerificationEvidence } from "@colibri/build-verification";

if ("evidence" in result) {
  await writeVerificationEvidence("verification.json", result.evidence);
}
```

Build logs are bounded before they enter errors or evidence.

## CLI

Run the package directly from JSR:

```sh
deno run -A jsr:@colibri/build-verification/cli \
  --contract-id C... \
  --network mainnet \
  --evidence verification.json
```

Out-of-band mode uses a JSON recipe file:

```sh
deno run -A jsr:@colibri/build-verification/cli \
  --wasm deployed.wasm \
  --source source.tar.gz \
  --recipe recipe.json \
  --allow-build-network
```

Use `--help` for all flags. Exit code `0` means `verified` or `notApplicable`,
`2` means `mismatch`, and `1` means verification did not complete.

## Scope

This package verifies reproducible contract builds. It does not publish SEP-55
attestations, manage a hosted build queue, operate a public verification
registry, or claim that reproduced source code has been audited.
