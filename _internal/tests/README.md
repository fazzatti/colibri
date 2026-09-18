# Repository test infrastructure

This directory is not part of any published Colibri package.

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

`deno task test`, `test:unit`, `test:integration`, and `test:file` now run
through one recorder configuration in `recorder/suite.ts`. Every package BDD
file calls `recordColibriTests(import.meta.url)`; tests creating Core clients or
pipelines attach their file observer to the original object. The fixture adapter
leaves direct `deno test` runs unrecorded, with standard BDD behavior, unless
the recorder CLI supplies a run directory. No package runtime imports this test
fixture.

```sh
# Entire package suite, including its existing Docker/network integrations:
deno task test

# Faster inspection without Docker/network integrations:
deno task test:unit

# One suite, with the same recording configuration:
deno task test:file core/contract/index.integration.test.ts

# Custom selection; arguments are passed to Deno's test runner:
deno task test:record --parallel core plugins/fee-bump
```

Each invocation prints `artifacts/colibri/<run-id>/report.html`. Open it
directly from disk. The adjacent JSON, JUnit and runtime journals retain
machine-readable evidence. Test assertions and runner exit codes are preserved.
The profile contains observed pipeline executions; tests of isolated helpers
still appear as tests, without invented transaction/resource measurements.
Static factories that execute before returning a client have only their
caller/test boundary available until that returned client is attached. Explicit
`observer.log` adds evidence; ordinary console output remains in the test runner
log.

The shared settings capture detailed parameters/results, authorization trees
without signatures, stage timings, simulated resource budgets and available
fees. Edit this single fixture to change the repository's recording verbosity.
Recorded timings include observer overhead; this report is diagnostic evidence,
not an uninstrumented performance benchmark.

CI records every package and all three build-verification shards in their
existing jobs. Each job uploads `test-evidence-<shard>` even after a test
failure. The `test evidence` job publishes `colibri-test-evidence` containing a
combined `report.html`, `report.json` and `sources.json`. Missing shards and
partial runs stay visible; the merger never treats missing evidence as a passing
test. Downloaded shard artifacts can be rebuilt without executing tests:

```sh
deno task test:record:merge artifacts/colibri-shards artifacts/colibri-report
```

Keep one downloaded artifact per child directory in `colibri-shards`. Duplicate
run IDs are rejected. `test:recorder-tooling` guards adoption and CI shard
coverage; `test:browser-runner` exercises the report in Chromium.
