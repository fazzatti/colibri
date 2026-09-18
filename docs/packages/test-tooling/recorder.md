# Record test evidence

The recorder observes Colibri contract clients and transaction pipelines. It
keeps transaction outcomes separate from test outcomes, captures optional
authorization and profiling data, and produces JSON plus an optional standalone
HTML report. Recorder entrypoints do not import Docker or start a ledger.

## Try the report locally

From a Colibri checkout, run `deno task test:recorder:demo`. It uses real
Colibri read pipelines with explicitly stubbed RPC responses; no network calls
or funded accounts are needed. Open the printed `report.html` path to inspect
three resource budget samples, an expected error, and an ignored test.

## Inspect Colibri's full suite

In a Colibri checkout, `deno task test:unit` generates a report for all package
unit tests. `deno task test` also runs the existing Docker and network
integrations; those require the same Docker services and endpoint access as
before. Use `deno task test:file <test-path>` for one suite. Each command prints
its HTML path.

CI uploads each shard's evidence even after failures, then publishes the
combined `colibri-test-evidence` artifact. Download it and open `report.html`;
`sources.json` lists its constituent runs. Failed, missing and incomplete
results remain visible. Recorded durations include observation overhead.
Isolated helper tests have test results but no transaction profile unless they
actually execute an attached pipeline.

## Configure once

Create a shared test configuration. Each Deno test-file runtime imports its own
instance; the CLI supplies a common run ID and combines the resulting journals.

<!-- deno-check -->

```ts
import { TestRecorder } from "@colibri/test-tooling/recorder/deno";

export const recorder = new TestRecorder({
  capture: "details",
  authorization: { level: "full", signatures: false },
  profiling: { timings: true, resources: true, fees: true },
  output: {
    summary: true,
    json: { directory: "./artifacts/colibri" },
    html: true,
  },
});
```

For direct use without output configuration, collection stays in memory. The CLI
uses temporary fragments for aggregation and removes them when neither JSON nor
HTML is retained. `recorder.report()` returns a defensive snapshot. Use the CLI
for final runner results and HTML; ordinary `deno test` plus JSON configuration
writes fragments only.

## Observe clients and pipelines

`recordTests(import.meta.url)` returns `describe`, `it`, `beforeAll`,
`afterAll`, `beforeEach`, `afterEach`, and `observer`. Their registration
semantics come from `@std/testing/bdd`, including options, flat suites, `only`,
`ignore`, and `skip`. Keep using your existing assertion library.

```ts
// token.test.ts — recorder is the shared instance above.
import { assertEquals } from "@std/assert";
import { Contract, NetworkConfig } from "@colibri/core";
import { recorder } from "./recording.ts";

const { describe, it, observer } = recorder.recordTests(import.meta.url);

describe("Token", () => {
  it("reads a balance", async () => {
    // Construct inside this test. The returned object is the original client.
    // Supply your deployed contract ID and its specification.
    const client = observer.create(() =>
      new Contract({
        networkConfig: NetworkConfig.TestNet(),
        contractConfig: { contractId, spec },
      }), { name: "token" });

    // No capture wrapper is needed to observe the underlying read pipeline.
    const balance = await client.read({
      method: "balance",
      methodArgs: { id },
    });
    assertEquals(balance, 0n);
  });
});
```

The fragment above uses application fixtures (`contractId`, `spec`, `id`). See
[Contract](../../core/contract.md) for client configuration.

| Helper                                 | Purpose                                                                                                                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observer.create(factory, options?)`   | Record construction, automatically attach supported returned clients/pipelines, preserve synchronous constructors and errors. Async factories are supported. Activity inside a factory before attachment is outside the plugin boundary. |
| `observer.attach(value, options?)`     | Attach once to an existing pipeline, or a client exposing `readPipe`, `invokePipe`, or `transactionPipe`, including SAC/SEP-41 wrappers with a public `contract`. Return the same object.                                                |
| `observer.capture(callback, options?)` | Optional caller boundary for exact returned values and encoding/decoding errors outside a pipeline. Labels are optional.                                                                                                                 |
| `observer.log(message, data?)`         | Add an explicit evidence item. Global console output is not intercepted.                                                                                                                                                                 |
| `observer.flush()`                     | Await pending journal writes without closing the observer.                                                                                                                                                                               |
| `recorder.report()`                    | Read the current normalized in-memory report.                                                                                                                                                                                            |

`options` can supply `name`, `metadata`, and `network`. Contract clients provide
their public `networkConfig` automatically; standalone pipelines should receive
network metadata explicitly. Names such as `read balance` and `invoke transfer`
come from the operation. Classic transactions list operation types.

Shared clients created in `beforeAll` remain supported. Async-local attribution
follows the current test, not the attachment site. Hooks have separate evidence
records. Construction/call records are not counted as extra transactions.

## Run and aggregate

```sh
deno run -A jsr:@colibri/test-tooling/recorder/cli run \
  --config=tests/recording.ts -- -A --parallel tests
```

The configuration module must export `recorder`. Arguments after `--` go to
`deno test`; the recorder owns `--junit-path`. Child tests need environment and
artifact-write permissions (`-A` above is appropriate for trusted local tests).
The runner preserves Deno's exit code and aggregates even when tests fail. A
reporting failure cannot turn a failed run into a successful command.

```text
artifacts/colibri/<run-id>/
  manifest.json
  runner.junit.xml
  fragments/<runtime-id>.jsonl
  report.json
  report.html
```

Fragments use independent random IDs and sequential events; workers never append
to a shared file. Registration and test/hook boundaries flush evidence,
including files containing only ignored tests. Abrupt termination may lose the
current observation; missing completion or a truncated journal is visible as
incomplete. Files from different runs or broken event sequences are rejected.

Rebuild after downloading CI artifacts, without rerunning transactions:

```sh
deno run -A jsr:@colibri/test-tooling/recorder/cli aggregate \
  artifacts/colibri/<run-id> --html
```

Upload the entire run directory in an `always()` CI step. The HTML embeds its
data, styles and scripts, opens directly from disk, and makes no network
requests.

## Read the HTML report

**Summary** is the initial view. It shows counts and a file table organized by
relative directories. Clicking anywhere on a context row expands or collapses
its children in place; clicking a file opens its tests in Evidence. Run
completeness and runner exit codes remain separate from selected test counts,
including consolidated runs with reruns.

**Evidence** uses the sidebar for folders and files. Folder rows only expand or
collapse; there are no separate directory pages or duplicate “View” links.
Single-child directory chains are combined, test files and test cases use a
test-tube icon, and the selected file has a filled highlight. With no file
selected, the main panel shows a flat, searchable file table with full relative
paths and result counts.

Inside a file, suite rows expand inline to reveal tests and shared setup or
teardown. Select a test for its chronological captured observations, then a
pipeline call for its details. Overview and Measurements stay visible above
three tabs: **Pipeline stages**, **Inputs and results**, and **Authorization**.
The tab bar remains reachable while scrolling long evidence. Inputs/results and
authorization open their main payload immediately; additional payloads remain
expandable. Arrow keys and Home/End switch tabs, and the selected tab persists
in the offline URL and browser history. Opening another call starts on Pipeline
stages. File, test and call lists are paginated without a fixed record limit.
Hash copy buttons briefly change to **Copied**. If the clipboard is unavailable,
a message beside that hash explains how to copy the selected text manually. Copy
feedback does not carry across report views.

Clear context sits immediately beside the current breadcrumb. Breadcrumbs and
browser Back/Forward preserve your location. The URL fragment records the
current selection and filters, including when the HTML opens from disk. Search
accepts test/file names, contract IDs and hashes. Test outcome, pipeline outcome
and chain outcome are independent filters; an expected failed pipeline call can
belong to a passing test. Client/method filters and context apply across all
three report views.

**Profiling** opens with **Individual pipeline calls**. Each row represents one
observed pipeline invocation, not one test or necessarily one submitted
transaction. A read can simulate without submitting; an invoke can simulate,
sign and submit; a classic call can contain several Stellar operations.

Timing, resources and fees appear together: duration, instruction budget,
read-only/read-write entries, disk read/write bytes, simulation minimum resource
fee and confirmed fee charged. Every measurement heading sorts its column, and
its min/max fields filter individual calls. Numeric filters apply only in
Profiling and remain in the URL. Missing values stay unavailable, sort last in
either direction and are excluded when a range is active. Invalid or reversed
ranges show a correction message. **Clear filters** also clears these ranges.
The table scrolls horizontally with sticky headings and a fixed call column.
Pipeline and chain outcomes have separate columns.

**Compare repeated calls** is an optional aggregate view. Groups keep file,
network, client label, contract, method, kind, operation sequence and
pipeline/chain outcomes distinct. Enable **Group across files** explicitly to
remove the file boundary. Missing network or operation identity keeps calls
separate. A group may contain only one call; its count means recorded pipeline
invocations. Select a group to see the exact grouping keys, per-metric sample
counts and its individual calls. Ranges filter calls before groups and their
statistics are calculated.

Group rows show medians for all measurements together and the duration range.
Group details show available sample counts, nearest-rank medians, ranges and
standard deviations. Mean, nearest-rank p95 and population variance (squared
units) are under More statistics. Single samples do not establish repeatability.
Resources use the last captured simulation budget per call, with every captured
simulation available in the call evidence. Fees retain exact whole stroops for
sorting, filtering, medians and ranges; their means and deviations are not
calculated.

Inputs can differ within a group, and client labels do not establish object
identity. These statistics describe captured calls rather than an
equivalent-workload benchmark. HTML grouping is intentionally more specific than
the portable `profileGroups(report)` helper's
network/client/contract/method/kind grouping.

## Capture and profiling options

| Option                         | Meaning                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `capture: "summary"`           | Minimal observation identity/status and configured profiling.                                                                           |
| `capture: "results"` (default) | Also retain results and errors.                                                                                                         |
| `capture: "details"`           | Also retain operation parameters and supplied metadata.                                                                                 |
| `capture: "trace"`             | Also retain bounded step input/output snapshots.                                                                                        |
| `authorization.level`          | `none` (default), `summary` counts/types, or `full` invocation trees, addresses, nonces and expiration ledgers.                         |
| `authorization.signatures`     | Explicit opt-in to encoded signed authorization entries; false by default.                                                              |
| `profiling.timings`            | UTC timestamps and monotonic durations at observed pipeline/step boundaries.                                                            |
| `profiling.resources`          | Simulation instruction/byte budgets and read-only/read-write footprint entry counts.                                                    |
| `profiling.fees`               | Simulation minimum resource fee, submitted max fee and available confirmed charged fees, in stroops.                                    |
| `limits`                       | Positive limits for records (10,000), snapshot depth (8), entries per container (100), and string length (4,096). Truncation is marked. |
| `sanitize`                     | Optional additional sanitizer over normalized values, after built-in redaction.                                                         |

Signer objects, secret-bearing keys, raw signatures and XDR fields are redacted
from ordinary snapshots. Getters and arbitrary SDK/client internals are not
traversed. Big integers become decimal strings. Review application-supplied
messages and metadata before sharing artifacts: free-form text may contain data
that a key-based redactor cannot recognize.

Simulation resources are recommended budgets, **not actual CPU or memory
usage**. Restoration estimates stay separate. The last simulation supplies the
aggregate budget sample; each distinct simulation remains visible in execution
evidence. The no-op enforcement step does not create a second simulation sample.
Confirmed resource fees are distinct from simulation estimates; rent is a
component of fees, not an extra fee to add to their total. Missing measurements
remain absent.

## Observation boundaries

- Install the recorder after other persistent plugins. It returns original input
  tuples, outputs and errors and never retries, signs or submits anything.
- Existing Convee hooks cannot see earlier hook time, later per-run transforms,
  errors already recovered before the observer, or a finalizer aggregate
  produced after finalizers run. `capture()` can add an exact public caller
  boundary.
- The send step combines submission and confirmation polling. Its duration is
  combined; RPC acknowledgment latency and poll counts are not inferred.
- A failed operation can belong to a passing test using `assertThrows` or
  `assertRejects`. A successful transaction can precede a decoding/assertion
  error. Pipeline status, chain status, callback status and runner status stay
  separate.
- Deno's JUnit can attribute BDD tests to wrapper source locations. The adapter
  matches exact file/full-name pairs, then globally unique full names.
  Duplicate, filtered or interrupted names stay unknown; suite totals are not
  counted as leaf tests. Use unique suite/test paths when final runner
  attribution matters.
- Overlapping executions that explicitly reuse the same Convee parent context
  have ambiguous step attribution. The report diagnoses this instead of
  assigning stages to the wrong execution.

For custom runners, use `ExecutionRecorder` from
`@colibri/test-tooling/recorder`. Rendering and statistics are available from
`@colibri/test-tooling/recorder/report`; Deno integration and the CLI remain
separate entrypoints.
