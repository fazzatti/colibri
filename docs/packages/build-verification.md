# Contract Build Verification

`@colibri/build-verification` rebuilds Stellar contract source inside an exact,
digest-pinned build image and compares the rebuilt WASM bytes with a local or
deployed target.

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
  network: NetworkConfig.MainNet(),
});

const result = await verifier.verify({
  target: { contractId: "C..." },
});
```

Strict mode uses the contract's own `bldimg`, ordered `bldarg`, `bldopt`,
`source_uri`, and `source_sha256` metadata. The exact source archive is hashed
before safe extraction, and the rebuilt WASM is selected without guessing.

## Interpret the result

```typescript
switch (result.status) {
  case "verified":
    console.log(result.evidence);
    break;
  case "mismatch":
    console.log(result.evidence.build.rebuiltWasmHash);
    break;
  case "notApplicable":
    console.log(result.reason);
}
```

Operational failures throw typed Colibri errors. `mismatch` is returned only
after a build completes and byte comparison is possible.

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

The resulting evidence explicitly identifies the recipe as caller-supplied. It
does not claim that the target committed to that recipe.

## Security defaults

- Build network access is disabled unless `allowBuildNetwork: true` is set.
- The default policy accepts only the official Stellar CLI repository.
- Multi-platform image indexes and unpinned image tags are rejected.
- Source extraction rejects traversal, links, special files, ambiguous roots,
  and configured resource-limit violations.
- Container output is bounded, and Docker execution uses read-only and
  resource-limited defaults.

Use disposable workers or VMs for hosted verification of untrusted source.
Container isolation alone is intended for the local developer workflow.

See the [package README](../../build-verification/README.md) for granular
network inputs, custom image policies, evidence export, and CLI usage.
