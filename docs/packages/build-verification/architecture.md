# Pipelines, providers, and runners

[Contract Build Verification overview](../build-verification.md)

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

## Choose the smallest public layer

| Layer                                   | Use it for                                             |
| --------------------------------------- | ------------------------------------------------------ |
| `verifyContractBuild`                   | One verification with explicit options                 |
| `ContractBuildVerifier`                 | Reusable configuration and an owned `verificationPipe` |
| `createBuildVerificationPipeline`       | Explicit dependency composition and plugins            |
| Process functions                       | One atomic action with typed inputs/outputs            |
| Step factories and IDs                  | Convee composition around those processes              |
| Providers, runner, extractor, collector | Replace a specific I/O boundary                        |

The stable step IDs, in order, are:

1. `resolve-verification-target`
2. `parse-contract-metadata`
3. `validate-build-recipe`
4. `resolve-source-archive`
5. `resolve-build-image`
6. `execute-contract-build`
7. `select-build-artifact`
8. `compare-contract-wasm`

These are plugin attachment points. A plugin should target its intentional stage
rather than duplicating the verifier or changing unrelated state.

## Replace a boundary, not the verification rules

Constructor options accept `targetResolver`, `sourceProvider`, `imageResolver`,
`archiveExtractor`, `artifactCollector`, and `runner`. Their interfaces are in
the [API reference](https://jsr.io/@colibri/build-verification/doc).

`ContractBuildRunner.run(plan)` executes an approved plan. It receives the
source directory, resolved image, ordered arguments, Rust toolchain, network
setting, and resource limits. It returns successful execution facts and its
reported capabilities. It does **not** discover the source, select the output
Wasm, or declare the final comparison result. Keep those separate when
implementing a VM/disposable-worker runner.

The root entrypoint includes host adapters and the high-level verifier. `/core`
exports deterministic parsing, recipe, policy, comparison, evidence, and domain
types without constructing RPC, filesystem, Docker, or CLI adapters. `/docker`
exports the Docker runner and its configuration; `/cli` is the command
entrypoint.

Custom providers/runners expand your trusted implementation boundary. Do not
claim the default Docker isolation guarantees for another runner unless that
runner actually enforces them.
