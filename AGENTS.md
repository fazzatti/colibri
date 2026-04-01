# AGENTS.md

This file gives repository-level instructions to coding agents working in the
Colibri workspace.

These instructions apply to the whole repository unless a deeper `AGENTS.md`
file overrides them for a subdirectory. At the time of writing, the only nested
file is:

- `test-tooling/AGENTS.md`

## Overview

Colibri is a Deno workspace that publishes multiple TypeScript-first Stellar and
Soroban packages:

- `core/`: the architectural center of the repo. It defines the shared error
  model, networks, accounts, signers, helpers, processes, steps, pipelines,
  plugins, contract clients, event tooling, ledger parsing, and utilities.
- `sep10/`: a SEP-10 web auth client package built on top of Colibri core.
- `rpc-streamer/`: a generic callback-based RPC streaming package with event and
  ledger variants.
- `plugins/fee-bump/`: a plugin that wraps outgoing transactions in a fee-bump
  transaction.
- `plugins/channel-accounts/`: channel-account lifecycle tools and a plugin for
  swapping a pooled channel into classic and invoke-contract runs.
- `test-tooling/`: Docker-backed Quickstart helpers for integration tests.
- `_internal/`: internal-only fixtures, env helpers, compiled WASM files, Rust
  contracts, and test-only support code. This directory is not a published
  package.
- `_tools/`: internal tooling, currently including the custom lint rule used by
  some packages.

There is a root `README.md`, package-specific `README.md` files, an external
docs site, and an external examples repo. Keep consumer-facing package guidance
in package docs; keep repository workflow guidance here.

## Commands

Primary workspace commands live in `deno.json`:

```bash
deno lint
deno task check
deno task check:jsr
deno task test
deno task test:unit
deno task test:integration
deno task test:file <path>
```

What they mean:

- `deno lint`: lint the workspace.
- `deno task check`: type-check the public entrypoints for all published
  packages.
- `deno task check:jsr`: run `deno doc --lint` against the JSR entrypoints.
  Public exports need valid docs.
- `deno task test`: run the full suite, including unit and integration tests.
- `deno task test:unit`: run fast unit coverage without integration tests.
- `deno task test:integration`: run integration tests only.
- `deno task test:file <path>`: run a specific test file with the same base
  flags as the rest of the repo.

Good default validation:

```bash
deno lint
deno task check
deno task check:jsr
deno task test:unit
```

Strongly consider integration coverage when you touch behavior that depends on
real runtime boundaries, especially:

- pipeline orchestration, connector sequencing, or plugin hook behavior
- live RPC, archive RPC, Horizon, Friendbot, provider, or anchor-facing flows
- contract deployment/execution, asset or SAC flows, or checked-in wasm/spec
  fixtures
- streaming behavior that depends on live/archive ledger boundaries
- Docker or Quickstart lifecycle behavior in `test-tooling/`

Pure helpers, type guards, formatting/parsing utilities, small error modules,
and other isolated logic usually only need unit tests unless the package already
has an integration seam for that behavior.

## CI And Release

GitHub Actions behavior matters when changing structure or versions:

- CI runs on pushes and pull requests targeting `main` and `dev`.
- CI runs `deno lint`, `deno task check`, `deno task check:jsr`, and
  `deno task test`.
- CI generates coverage from the `coverage/` directory and uploads it to
  Codecov.
- The publish workflow runs only on pushes to `main`.
- Publish detects package version bumps from each package `deno.json` and then
  creates tags if the tag does not already exist.

Current package version sources:

- `core/deno.json`
- `sep10/deno.json`
- `rpc-streamer/deno.json`
- `plugins/fee-bump/deno.json`
- `plugins/channel-accounts/deno.json`
- `test-tooling/deno.json`

Release implications:

- Only bump package versions deliberately.
- If a change is not intended for publishing, do not casually change versions.
- If you change public exports or behavior in a published package, verify the
  package README and JSDoc still describe the new API.

## Workspace Structure And Boundaries

This repo has a strong architectural boundary system. Preserve it.

### 1. Processes, steps, connectors, and pipelines are distinct layers

In `core/` especially, keep these roles separate:

- Processes are the reusable, plain execution units. They do the real work.
- Steps are thin `convee` wrappers around processes with stable step ids.
- Connectors translate the output of one step into the input of the next.
- Pipelines orchestrate end-to-end flows by composing steps and connectors.

Do not collapse these layers together unless the existing code in that area
already does so.

Examples:

- Process files live under `core/processes/*`.
- Step factories live under `core/steps/*`.
- Shared connectors live under `core/pipelines/shared/connectors/*`.
- Pipeline-local connectors live next to the owning pipeline.
- High-level pipelines live under `core/pipelines/*`.

### 2. Stable ids are part of the contract

The plugin system and runtime composition depend on stable pipeline and step
identifiers. Treat them as API surface.

Pipeline ids:

- `ClassicTransactionPipeline`
- `ReadFromContractPipeline`
- `InvokeContractPipeline`

Step ids currently defined in `core/steps/ids.ts`:

- `build-transaction`
- `simulate-transaction`
- `sign-auth-entries`
- `assemble-transaction`
- `envelope-signing-requirements`
- `sign-envelope`
- `send-transaction`
- `wrap-fee-bump`

Do not rename pipeline ids, step ids, or plugin targets casually. If one must
change, assume downstream plugins, tests, and docs need coordinated updates.

### 3. Plugins are runtime extension points, not ad hoc hooks

There are two main plugin patterns in the repo:

- Step-targeted plugins, such as `@colibri/plugin-fee-bump`, which targets the
  `send-transaction` step.
- Pipe-level plugins, such as `@colibri/plugin-channel-accounts`, which targets
  whole pipeline ids.

If you add or change plugin behavior:

- preserve the stable plugin id and target model
- keep plugin logic compatible with the owning pipeline contracts
- remember that plugin attachment points are public integration seams

### 4. High-level clients should build on the lower layers, not bypass them

`Contract`, `StellarAssetContract`, SEP-10 helpers, and streamers are meant to
compose lower-level primitives. Avoid introducing a second orchestration path
that duplicates pipeline or process behavior unless there is a very strong
reason.

## Error Model

Colibri's typed error system is one of the most important repo-wide invariants.

Rules:

- Prefer typed errors with stable codes over generic thrown `Error` instances.
- Public and reusable modules should expose a stable error namespace.
- Unexpected failures are generally wrapped into a typed error class rather than
  being allowed to leak as raw unknown exceptions.
- Structured metadata matters. Keep `meta`, `details`, `diagnostic`, and
  `source` useful.

Common patterns already used across the repo:

- A `Code` enum per error module.
- A base typed error class per domain or package.
- Concrete error subclasses per stable code.
- An exported registry such as `ERROR_PIPE_*`, `ERROR_*`, or `ERROR_BY_CODE`.
- Use of `assertRequiredArgs(...)` and `assert(...)` to fail with typed errors.
- Use of `ColibriError.fromUnknown(...)` or `ColibriError.unexpected(...)` when
  wrapping unknown failures.

Examples of the existing naming scheme:

- pipeline codes like `PIPE_INVC_*`, `PIPE_CLTX_*`, `PIPE_RFC_*`
- process codes like `BTX_*`, `SIM_*`, `STX_*`, `SAE_*`, `WFB_*`
- plugin codes like `PLG_FBP_*`, `PLG_CHA_*`

Do not replace these with untyped string messages or generic exceptions.

## Public API And Export Conventions

The repo consistently favors named exports and barrel entrypoints.

Observed conventions:

- no default exports in the published packages
- package entrypoints are `mod.ts`
- internal package entrypoints are usually `index.ts`
- internal imports generally use the package-local `@/` alias
- public entrypoints re-export named APIs from internal modules

When changing package exports:

- update the package `mod.ts`
- keep `deno.json` `exports` aligned
- ensure the package README still matches the exported API
- ensure `deno task check:jsr` still passes

Do not rewrite unrelated imports just to normalize style. Follow the style of
the package you are editing.

## Documentation Conventions

Public packages in this repo are documentation-heavy by design.

Observed conventions:

- public entrypoints and many public classes/functions use JSDoc
- module entrypoints often include `@module`
- many public APIs include `@example` blocks
- package READMEs explain installation, quick starts, and major concepts

Because CI runs `deno doc --lint` on package entrypoints:

- document new public exports
- keep existing doc comments accurate when behavior changes
- prefer updating docs in the same change when the public API changes

## Testing Conventions

The repo has clear naming and placement patterns for tests.

### Test file naming

- `*.unit.test.ts`: unit tests
- `*.integration.test.ts`: integration tests
- `*.testnet.integration.test.ts`: testnet-backed integration tests

Task behavior comes from these names:

- `test:unit` excludes both `*.integration.test.ts` and
  `*.testnet.integration.test.ts`
- `test:integration` excludes `*.unit.test.ts`

### Test organization

Use `@std/testing/bdd` with `describe`/`it` for test structure across the
workspace, including `test-tooling/quickstart/`.

If you touch older tests that still use plain `Deno.test(...)`, prefer migrating
them to BDD structure instead of adding more tests in the older style.

### Sanitizer settings

Long-lived network, timer-heavy, and some external-resource tests often use:

- `colibri-internal/tests/disable-sanitize-config.ts`

Use that existing pattern when a test genuinely needs sanitizer relaxation. Do
not disable sanitizers by default.

### `_internal/` is intentionally excluded from test discovery

Root test tasks use `--ignore='_*/'`, so directories such as `_internal/` are
not test-discovered directly.

Implications:

- `_internal/tests/*` is for fixtures and helpers, not for auto-discovered test
  entrypoints
- keep runnable tests in the package directories, not under `_internal/`

### Environment and external dependencies

Some integration tests require external dependencies:

- public RPC/network access
- Friendbot access
- Docker access for `test-tooling`
- optional `QUASAR_API_KEY` from `.env` or environment for certain provider and
  streamer integration tests

The only documented env variable in `.env.example` is:

- `QUASAR_API_KEY`

If you add more environment-sensitive tests, document them.

## Package-Specific Notes

### `core/`

This is the package that defines most repo-wide architectural rules.

Keep these invariants:

- `NetworkConfig`, accounts, signers, helpers, processes, steps, pipelines, and
  clients are designed to compose cleanly.
- `Contract` owns `invokePipe` and `readPipe`; higher-level clients such as
  `StellarAssetContract` build on top of it.
- shared pipeline connectors use `convee` runtime context and step snapshots; do
  not invent a parallel state-passing mechanism.
- plugin attachment points are intentional and stable.

If you change `core/`, consider ripple effects on all dependent packages.

### `sep10/`

Keep the split between:

- challenge parsing/building/verification
- client request flow
- JWT parsing
- small utility helpers

This package relies on `@colibri/core` for shared primitives but should remain a
clean, focused SEP-10 package rather than absorbing unrelated Stellar helpers.

### `rpc-streamer/`

Preserve the architecture:

- `RPCStreamer<T>` is the reusable generic engine
- event and ledger streamers are thin variants built on top
- live ingestion and archive ingestion are explicit, separate concepts

Do not hard-wire variant-specific logic into the generic streamer unless it is a
true cross-variant concern.

### `plugins/fee-bump/`

Important local rules:

- this plugin targets the `send-transaction` step, not whole pipelines
- it wraps the transaction via an internal fee-bump pipeline
- the behavior is tightly coupled to stable step ids from `@colibri/core`

If you change its target or wrapping behavior, expect downstream breakage.

### `plugins/channel-accounts/`

Important local rules:

- this is a pipe-level plugin, not a step-level one
- it supports `ClassicTransactionPipeline` and `InvokeContractPipeline`
- it allocates a pooled channel on input and must release it on both success and
  error paths
- zero-balance channels are often paired with fee-bump sponsorship

Be especially careful with allocation/release correctness and failure cleanup.

### `test-tooling/`

See `test-tooling/AGENTS.md` for package-specific instructions. That package has
meaningfully different runtime assumptions from the rest of the workspace.

## Internal Contracts And Fixtures

`_internal/contracts/*` contains Rust Soroban contracts used as fixtures and
test harnesses.

Important related files:

- `_internal/contracts/fungible-token/*`
- `_internal/contracts/types-harness/*`
- `_internal/tests/compiled-contracts/*`
- `_internal/tests/specs/*`

Implications:

- compiled `.wasm` files in `_internal/tests/compiled-contracts/` are checked-in
  fixtures used by integration tests
- embedded `Spec(...)` constants in `_internal/tests/specs/` are also used by
  tests
- if a contract ABI or fixture changes, keep the Rust source, compiled wasm, and
  matching test specs in sync

Contract build helpers exist in the package `Makefile`s and use
`stellar contract build`.

## Lint And Style Notes

The repo largely follows Deno/TypeScript defaults plus a few local conventions:

- package-local imports prefer `@/`
- named exports are standard
- public APIs are documented
- comments should explain non-obvious behavior, not restate code

There is also a custom lint rule in:

- `_tools/lint/enum-requires-own-file.ts`

It is currently wired into:

- `core/deno.json`
- `test-tooling/deno.json`

That rule requires enums with more than 50 members to live alone in their file.
If you add or expand large enums in those packages, keep that rule in mind.

## Change Checklist

Before finishing a change, check the relevant subset of this list:

- Did you preserve the process/step/connector/pipeline boundaries?
- Did you keep stable step ids, pipeline ids, and plugin targets intact?
- Did you preserve the typed error model and stable codes?
- Did you update public docs and examples when public APIs changed?
- Did you update package entrypoints when exports changed?
- Did you run at least `deno lint`, `deno task check`, and the relevant tests?
- If you changed integration-heavy behavior, did you run the relevant
  integration tests?
- If you changed internal Rust contract fixtures, did you sync wasm/spec
  artifacts too?

## Commit Hygiene

When creating commits for this repository:

- Never add yourself to the list of commit co-authors.
- Never mention yourself in commit messages in any way, including
  `Generated by`, AI tool references, or tool links.
