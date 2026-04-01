# AGENTS.md for `test-tooling/`

These instructions apply when editing `test-tooling/`.

## Scope

`test-tooling/` is intentionally different from the rest of the workspace:

- it is Docker-backed
- it models runtime infrastructure rather than transaction orchestration
- it exposes a typed Quickstart harness instead of Colibri pipeline APIs

Follow the local patterns here instead of forcing this package to look exactly
like `core/`.

## Purpose

The main public API is `StellarTestLedger`, a Quickstart harness that:

- discovers or accepts Docker connection settings
- starts, reuses, inspects, stops, and destroys Quickstart containers
- resolves service URLs into typed network details
- supports local, testnet, and futurenet modes
- supports ephemeral and persistent storage

Do not turn this package into a generic Colibri utility dump. Keep it centered
on test infrastructure and Quickstart lifecycle management.

## Commands

Useful local commands:

```bash
deno test -A --parallel --clean --ignore='_*/' test-tooling/quickstart/*.unit.test.ts
deno test -A --parallel --clean --ignore='_*/' test-tooling/quickstart/index.unit.test.ts
deno test -A --parallel --clean --ignore='_*/' test-tooling/quickstart/index.integration.test.ts
```

Or use workspace tasks:

```bash
deno task test:unit
deno task test:integration
deno task test:file test-tooling/quickstart/index.unit.test.ts
```

Run integration tests only when Docker is available.

## Core Invariants

Preserve these package-specific rules:

- `StellarTestLedger` accepts arbitrary Quickstart image tags through
  `containerImageVersion`. Do not replace that with a narrow allow-list.
- Docker endpoint discovery order matters. Respect the existing precedence of
  explicit options over environment-driven or auto-detected values.
- `getNetworkDetails()` and related types are intentionally shaped by the chosen
  network and enabled services. Preserve that type-level precision.
- Local mode, testnet, and futurenet have different readiness and service
  expectations. Avoid flattening them into one generic path.
- Cleanup behavior matters. Startup failures, stale containers, reused
  containers, and destroy/stop flows all need deterministic handling.

## Error Model

Unlike most of the rest of the repo, this package uses `QuickstartError` instead
of `ColibriError`.

Preserve the local error pattern:

- `Code` enum
- `QuickstartError` base class
- concrete subclasses such as `INVALID_CONFIGURATION`,
  `DOCKER_CONFIGURATION_ERROR`, `CONTAINER_ERROR`, `IMAGE_ERROR`, and
  `READINESS_ERROR`
- exported error registry `ERROR_TTO_QKS`

Do not convert this package to `ColibriError` unless the whole package design is
being deliberately changed.

## Test Conventions

Follow local style:

- use `@std/testing/bdd` with `describe`/`it`
- tests often stub Dockerode behavior directly rather than using broad mock
  wrappers
- keep low-level utility coverage grouped coherently under BDD `describe(...)`
  blocks rather than standalone tests

When adding tests:

- prefer isolated unit coverage for parsing, normalization, and cleanup logic
- add integration coverage only for behavior that truly needs a real Docker
  daemon or running Quickstart container
- always clean up containers in integration tests

## Implementation Notes

The important files are:

- `quickstart/index.ts`: main harness and option normalization
- `quickstart/docker.ts`: Docker connection parsing and client creation
- `quickstart/runtime.ts`: container lifecycle, readiness, logs, and cleanup
- `quickstart/types.ts`: public type surface
- `quickstart/error.ts`: typed error model
- `quickstart/logging.ts`: logging abstraction and levels

Keep responsibilities separated. Do not move container lifecycle logic into the
type module or bury option normalization inside tests.

## When Changing Public Behavior

If you change public behavior in `test-tooling/`:

- update `test-tooling/README.md`
- keep `test-tooling/mod.ts` exports accurate
- verify `test-tooling/deno.json` publish includes still make sense
- add or update unit tests before relying only on integration coverage
