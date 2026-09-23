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

| Layer                                               | Use it for                                             |
| --------------------------------------------------- | ------------------------------------------------------ |
| `verifyContractBuild`                               | One verification with explicit options                 |
| [`ContractBuildVerifier`](../build-verification.md) | Reusable configuration and an owned `verificationPipe` |
| `createBuildVerificationPipeline`                   | Explicit dependency composition and plugins            |
| Process functions                                   | One atomic action with typed inputs/outputs            |
| Step factories and IDs                              | Convee composition around those processes              |
| Providers, runner, extractor, collector             | Replace a specific I/O boundary                        |

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

## Compose a source provider

The smallest replacement is an existing provider configured for your input
boundary. For example, `ArchiveVerificationSourceProvider` accepts only
caller-supplied [archive bytes](sources.md#exact-input-shapes), rejecting URL
and directory inputs. It retains archive-size checks and hashing; extraction and
strict source-hash verification still happen in the pipeline.

This complete configuration module exports a verifier for an application-owned
worker runner. Install [Build Verification](../build-verification.md) and save
it as `verification.ts`; importing it does not start a verification. The caller
supplies the implementation of
[`ContractBuildRunner`](https://jsr.io/@colibri/build-verification/doc/~/ContractBuildRunner).

<!-- deno-check -->

```ts
import {
  ArchiveVerificationSourceProvider,
  type ContractBuildRunner,
  ContractBuildVerifier,
} from "@colibri/build-verification";

export function verifierForWorker(runner: ContractBuildRunner) {
  return new ContractBuildVerifier({
    sourceProvider: new ArchiveVerificationSourceProvider(),
    runner,
  });
}
```

Call the returned verifier's `verify` with an explicit archive source. A
strict-mode recipe that discovers a URL needs the default URL-capable provider
instead. To build your own
[`VerificationSourceProvider`](https://jsr.io/@colibri/build-verification/doc/~/VerificationSourceProvider),
implement `resolve(input)` with the supplied limits and return the exact source
facts. A replacement owns its retrieval policy and credential handling; setting
`urlHeaders` on the verifier does not configure an arbitrary custom provider.
See [authenticated downloads](sources.md#authenticated-url-downloads) for the
default router's behavior.

## Compose the pipeline directly

[`createDefaultBuildVerificationDependencies`](https://jsr.io/@colibri/build-verification/doc/~/createDefaultBuildVerificationDependencies)
fills the unchanged boundaries while accepting the same overrides as the
high-level verifier. This complete function accepts a caller-owned runner and
one [verification request](targets.md), then returns the usual verification
result:

<!-- deno-check -->

```ts
import {
  type ContractBuildRunner,
  type ContractBuildVerificationInput,
  createBuildVerificationPipeline,
  createDefaultBuildVerificationDependencies,
} from "@colibri/build-verification";

export async function verifyWithRunner(
  runner: ContractBuildRunner,
  input: ContractBuildVerificationInput,
) {
  const dependencies = createDefaultBuildVerificationDependencies({ runner });
  const pipeline = createBuildVerificationPipeline(dependencies);
  return await pipeline.run(input);
}
```

Supply network options to the dependency factory for network-resolved targets.
The runner receives an approved `ContractBuildPlan` and must enforce its limits,
network setting and image identity, then report execution facts and actual
capabilities. It does not declare byte-for-byte verification success. The
pipeline retains artifact selection and comparison.

For one isolated stage, use the exported
[process functions](https://jsr.io/@colibri/build-verification/doc/~/resolveSourceArchive)
and their input/output types; for a Convee composition, use the
[step factories](https://jsr.io/@colibri/build-verification/doc/~/createResolveSourceArchiveStep)
and [stable IDs](#pipeline-architecture). Calling a process independently does
not imply that the preceding validation stages have run.
