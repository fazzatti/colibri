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

In a Colibri checkout, normal `test`, `test:unit`, `test:integration`, and
`test:file` tasks run without recorder artifacts. Coverage remains independent.
For evidence, use `deno task test:record <test-paths>`; it runs the selected
tests and generates the configured JSON/HTML automatically. Use
`deno task test:record --ignore='_*/'` for the complete suite, including its
existing Docker/network integrations. Serial execution avoids concurrent
requests to the shared Mainnet archive provider.

Recording must happen during execution. Running an aggregation command later
cannot recover evidence that was never captured. Normal pull-request CI also
runs without recording; manually enable **record_evidence** to upload each
shard's evidence and the combined `colibri-test-evidence` artifact. Download
that artifact and open `report.html`; `sources.json` lists its runs. Failed,
missing and incomplete results remain visible. Recorded durations include
observation overhead. Helper tests have results but no transaction profile
unless they execute an attached pipeline.

## Configure once

Create a shared test configuration. Each test-file worker imports its own
instance; the CLI supplies a common run ID and combines the resulting journals.

<!-- deno-check -->

```ts
import { TestRecorder } from "@colibri/test-tooling/recorder/deno";

export const recorder = new TestRecorder({
  capture: "details",
  events: "full",
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

## Node and npm

Install the same package with `npx jsr add @colibri/test-tooling`. Node 22.12+
and Node 24 use `@colibri/test-tooling/recorder/node`, with no Deno executable.
Both adapters share capture settings, observers, profiling, sanitization,
limits, journals, aggregation and HTML reports. Their BDD registrations follow
their native runner: `node:test` on Node and `@std/testing/bdd` on Deno. Node
supports concurrent tests, `only`, `skip`, `todo`, callback-style tests and
native hook options; `ignore` aliases `skip`, and `beforeAll`/`afterAll` also
have Node's `before`/`after` aliases. Node suites use nested callbacks rather
than Deno's flat `TestSuite` argument syntax. Jest/Vitest adapters are not
included.

For TypeScript consumers, install `@types/node` and include `"node"` in your
`compilerOptions.types` (TypeScript 6 requires explicit selection).

Save these three files (JavaScript ESM needs no TypeScript loader):

```js
// tests/recording.mjs
import { TestRecorder } from "@colibri/test-tooling/recorder/node";
export const recorder = new TestRecorder({
  capture: "details",
  events: "full",
  authorization: { level: "full", signatures: false },
  profiling: { timings: true, resources: true, fees: true },
  output: {
    json: { directory: "./artifacts/colibri" },
    html: true,
    summary: true,
  },
});
```

```js
// tests/example.test.mjs
import assert from "node:assert/strict";
import { recorder } from "./recording.mjs";
const { describe, it, observer } = recorder.recordTests(import.meta.url);
describe("Example", () => {
  it("captures a result", () => {
    const value = observer.capture(() => 7n);
    assert.equal(value, 7n);
  });
});
```

```js
// recorder.mjs — the same CLI API supports run and aggregate.
import { main } from "@colibri/test-tooling/recorder/cli";
process.exitCode = await main(process.argv.slice(2));
```

```sh
node recorder.mjs run --config=tests/recording.mjs -- tests/example.test.mjs
node recorder.mjs aggregate artifacts/colibri/<run-id> --html
```

An npm `test:record` script can contain the first command. Arguments after `--`
are passed to Node's native runner, including `--test-concurrency` and
`--test-name-pattern`. For TypeScript, configure the loader supported by your
Node version (for example `--import=tsx` with an application-installed loader).
The configuration module uses the CLI process's loader; tests use the child
runner's arguments. The recorder owns `--test-reporter` and its destinations;
watch mode and disabled file isolation are rejected so a run has one final
result. Existing stdout/stderr remain visible through Node's normal reporter.

Node writes `runner.node.jsonl` instead of Deno's `runner.junit.xml`. Both
produce the same report schema, separate observed callback status from final
runner status, aggregate after test failures, and preserve the runner's exit
code. In particular, a passing body followed by failing teardown stays failed.
Files with identical suite/test names are reconciled by worker file and full
path. Ambiguous names within one file remain unknown, not guessed.

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
Single-child directory chains are combined. Files use a file icon, test cases
use a test-tube icon, and setup/teardown hooks use entering/leaving arrows, and
the selected file has a filled highlight. With no file selected, the main panel
shows a flat, searchable file table with full relative paths and result counts.

Inside a file, suite rows expand inline to reveal tests and shared setup or
teardown. Select a test for its chronological captured observations, then a
pipeline call for its details. Overview and hashes stay visible above five tabs:
**Measurements**, **Pipeline stages**, **Inputs and results**,
**Authorization**, and **Events**. Measurements contains timing, resources, fees
and ledger effects, including their detailed captured payloads. The tab bar
remains reachable while scrolling long evidence. Inputs/results and
authorization open their main payload immediately; additional payloads remain
expandable. Arrow keys and Home/End switch tabs, and the selected tab persists
in the offline URL and browser history. Opening another call starts on Pipeline
stages. File, test and call lists are paginated without a fixed record limit.
Hash copy buttons briefly change to **Copied**. If the clipboard is unavailable,
a message beside that hash explains how to copy the selected text manually. Copy
feedback does not carry across report views. Valid transaction hashes link to
Stellar Expert when the recorded network passphrase exactly matches Testnet or
Mainnet; custom networks remain plain text. Method/operations appears directly
after Kind and includes both the Stellar operation and method, or the WASM
upload, contract deployment, restore or TTL-extension subtype.

The Events tab filters payloads by type (contract, system, or diagnostic/
unsuccessful), contract ID, and confirmed execution versus simulation. Filters
combine, survive reload/back navigation, and reset when opening a different
call. Counts show the number of matching captured payloads alongside original
collection totals; omitted payloads cannot be recovered by filtering. Confirmed
and simulated collections remain separate, including in empty results.

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
fee, confirmed fee charged and rent, confirmed/simulated event counts, confirmed
created/updated/removed/restored entry counts and TTL extensions, plus simulated
created entries and TTL extensions. Every measurement heading sorts its column,
and its min/max fields filter individual calls. Numeric filters apply only in
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
| `events`                       | `summary` (default) keeps counts, `full` adds bounded decoded payloads, and `none` disables event collection.                           |
| `authorization.level`          | `none` (default), `summary` counts/types, or `full` invocation trees, addresses, nonces and expiration ledgers.                         |
| `authorization.signatures`     | Explicit opt-in to encoded signed authorization entries; false by default.                                                              |
| `profiling.timings`            | UTC timestamps and monotonic durations at observed pipeline/step boundaries.                                                            |
| `profiling.resources`          | Simulation instruction/byte budgets, footprint counts, and available simulated/confirmed ledger changes.                                |
| `profiling.fees`               | Simulation minimum resource fee, submitted max fee and confirmed charged fees including rent, in stroops.                               |
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

## Events, rent and ledger changes

`events: "full"` enables the **Events** tab's decoded payloads: contract
address, topics and data, event type, operation index (when available), and
transaction stage. Counts are retained even when the entry limit omits payloads.
The configured sanitizer applies to all decoded event and ledger-change
payloads. **Confirmed execution** and each **Simulation** have separate
sections. Diagnostics and unsuccessful-call events remain visible but are
excluded from the emitted-event count. Successful diagnostic wrappers are not
counted again alongside their canonical confirmed events. Metadata v3 stores
Soroban events on `sorobanMeta`; v4 stores operation and transaction events
separately. The recorder reads one canonical metadata source, rather than adding
duplicate RPC and diagnostic representations. See the
[transaction metadata change in CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md).

`profiling.resources` also captures transaction and operation ledger mutation
records. Created, updated, removed and explicitly restored entries are counted,
including TTL entries. STATE records are baselines, not updates.
Transaction-level changes, including fee-related updates, are retained with
their before/operation/after origin. A TTL extension requires an updated TTL
entry with a known earlier live-until ledger and a strictly larger new value.
Missing baselines are counted separately as `ttlUnknown` in the saved evidence;
they are not assumed to be extensions. Counts describe mutation records rather
than unique keys across operations. Detailed/trace capture includes bounded
mutation payloads and TTL before/after values under **Inputs and results**.

The RPC can return simulated `stateChanges`; these remain estimates and are
never added to confirmed counts. Simulation supplies a minimum resource fee, not
a separate rent quote. Confirmed rent comes from the metadata's resource-fee
extension and is part of the charged fee, not an additional fee. All fees retain
exact decimal stroops. See the official
[simulation response](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/simulateTransaction)
and
[transaction metadata schema](https://github.com/stellar/stellar-xdr/blob/main/Stellar-ledger.x).

Old reports retain unavailable values for evidence they did not capture. Their
saved operation parameters can still identify WASM uploads and deployments.
Regenerating HTML cannot reconstruct missing events or ledger changes; run the
tests with the updated recorder to collect them. In the Colibri checkout,
`deno task test` records the full suite with full event payloads and profiling,
and prints the new run's JSON/HTML paths under `artifacts/colibri/<run-id>/`.

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
`@colibri/test-tooling/recorder/report`; Deno and Node integration and the
shared CLI have separate entrypoints.

### Artifact and asynchronous boundaries

Malformed manifest JSON is rejected as `TTO_REC_002`, preserving its parse
failure as the cause. The offline report treats malformed numeric measurements
as unavailable for sorting, filtering and statistics; raw evidence is retained.
`observer.capture()` and `observer.create()` observe settlement of custom
thenables as well as native promises, including rejections and deferred client
attachment.
