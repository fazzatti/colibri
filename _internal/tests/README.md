# Repository test infrastructure

This directory is not part of any published Colibri package.

## Runtime prerequisite

Use **Deno 2.7.11**, matching `.github/workflows/deno.yml`, for repository
tests. The React DOM harness rejects Deno 2.6: its CommonJS global/timer
behavior can stall `act()` until a session expires and produce a misleading
authentication failure. Check `deno --version` before rerunning.
Release/declaration tooling has its own Deno 2.9.6 requirement documented under
`_tools/releases/`.

## Quickstart diagnostics

Run the WebAuth lifecycle or Core SDEX suite with
`COLIBRI_TEST_QUICKSTART_DIAGNOSTICS=1` to include Quickstart service logs and
the actual Docker image ID in test output. CI enables this and uploads
`webauth-quickstart-diagnostics` and `core-quickstart-diagnostics` even when
their suites fail, before container cleanup can erase the evidence. SDEX also
records the final container state before stopping it, including the exit status
and Docker's OOM flag. The WebAuth suite currently uses the mutable
`nightly-next` tag for its protocol 28 fixtures; compare image IDs and the
service versions in these logs when investigating intermittent RPC failures.
Challenge-recording errors include the RPC's simulation ledger. SDEX uses the
mutable `testing` tag. Diagnostics do not retry transactions or challenges, or
relax any assertions.

## Mainnet archive integrations

The CAP-67 and RPC Streamer integration suites read real Mainnet events and
historical ledgers. They use `mainnet-archive-config.ts`, not a public provider
catalog. Override its endpoints with:

- `COLIBRI_TEST_MAINNET_RPC_URL`: live Mainnet Stellar RPC endpoint.
- `COLIBRI_TEST_MAINNET_ARCHIVE_RPC_URL`: archive RPC endpoint supporting the
  historical ledger/event ranges asserted by the suites.

The defaults retain the existing public Lightsail endpoints used by these tests.
Endpoint availability, retention and rate limits remain external test
dependencies; these tests are required and do not silently skip or switch
providers on failure. Run the RPC Streamer integrations serially, as in CI, to
avoid concurrent requests overwhelming the shared public archive endpoint.

These settings do not change the public `NetworkConfig.MainNet()` default, which
remains `https://mainnet.sorobanrpc.com`.

## Whole-suite execution evidence

`deno task test`, `test:unit`, `test:integration`, and `test:file` run ordinary
Deno tests without recorder output. Existing coverage settings are independent.
Every package BDD file calls `recordColibriTests(import.meta.url)`; without the
recorder CLI's environment, that adapter delegates to standard BDD helpers and
its observers do nothing. No package runtime imports this test fixture.

Use `test:record` when you want transaction evidence. Recording must be enabled
while tests execute; aggregation cannot reconstruct an unrecorded run.

```sh
# Normal tests, without recorder artifacts:
deno task test:unit
deno task test:file core/contract/index.unit.test.ts

# Explicit recording; the CLI runs tests and generates reports in one command:
deno task test:record --ignore='_*/'

# Record one file or only unit tests:
deno task test:record core/contract/index.unit.test.ts
deno task test:record --parallel --ignore='_*/' --ignore='**/*.integration.test.ts'
```

Full-suite recorded runs above are serial: the Mainnet archive suites share a
provider that rate-limits concurrent requests. Use parallelism only for a
selection that tolerates it. Recorded runs print
`artifacts/colibri/<run-id>/report.html`. The adjacent JSON, runner results and
runtime journals retain machine-readable evidence. Test assertions and runner
exit codes are preserved. The profile contains observed pipeline executions;
tests of isolated helpers still appear as tests, without invented
transaction/resource measurements. Static factories that execute before
returning a client have only their caller/test boundary available until that
returned client is attached. Explicit `observer.log` adds evidence; ordinary
console output remains in the test runner log.

The shared settings capture detailed parameters/results, authorization trees
without signatures, stage timings, simulated resource budgets and available
fees. Edit this single fixture to change the repository's recording verbosity.
Recorded timings include observer overhead; this report is diagnostic evidence,
not an uninstrumented performance benchmark.

Normal pull-request CI does not record evidence. To request a report, run CI
manually with **record_evidence** enabled. That run records every package and
all three build-verification shards. Each recording job uploads
`test-evidence-<shard>` even after a test failure. The `test evidence` job
publishes `colibri-test-evidence` containing a combined `report.html`,
`report.json` and `sources.json`. Missing shards and partial runs stay visible;
the merger never treats missing evidence as a passing test. Downloaded shard
artifacts can be rebuilt without executing tests:

```sh
deno task test:record:merge artifacts/colibri-shards artifacts/colibri-report
```

Keep one downloaded artifact per child directory in `colibri-shards`. Duplicate
run IDs are rejected. `test:recorder-tooling` guards adoption and CI shard
coverage; `test:browser-runner` exercises the report in Chromium.
