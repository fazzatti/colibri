# Evidence and logs

Evidence answers what target, source, recipe, image, and build were compared.
Logs describe progress and failures. Neither is an audit certificate.

This complete script verifies a local Wasm carrying SEP-58 metadata and writes
reports. Supply `./contract.wasm`, install the packages from the
[overview](../build-verification.md), ensure Docker is running, and run
`deno run -A verify.ts`. Metadata can cause remote source/image downloads.

<!-- deno-check -->

```ts
import {
  ContractBuildVerifier,
  writeVerificationEvidence,
  writeVerificationLogs,
} from "@colibri/build-verification";

const verifier = new ContractBuildVerifier({
  logger: { log: (event) => console.error(event.code) },
});
const result = await verifier.verify({
  target: { wasm: await Deno.readFile("./contract.wasm") },
});
await writeVerificationEvidence("./verification.json", result);
await writeVerificationLogs("./verification.jsonl", result.evidence.logs);
console.log(result.status);
```

## Results versus failures

`verified`, `mismatch`, and `notApplicable` are completed result variants.
Operational errors throw a `BuildVerificationError`; do not label a failed
download or timed-out build as a mismatch. The error can carry partial evidence
and logs from stages that finished. The CLI writes failure reports automatically
when report paths are supplied; API consumers can create a
`BuildVerificationFailureReport` and pass it to `writeVerificationEvidence`.

`writeVerificationLogs(path, events, { format: "text" })` chooses readable text;
the default is JSONL. `logger.log(event)` receives bounded structured events
during execution. Logger failures are nonfatal by default; `strictLogger: true`
makes them fail the verification workflow.

## Evidence boundaries

Inspect recipe provenance (`onChainSep58Metadata` versus `callerSupplied`),
source archive hash and resolved revision, image manifest/runtime digest,
selected artifact hash, byte comparison, and runner capabilities.
Provenance/SBOM observations do not assert a cryptographic signature was checked
when it was not.

Built-in evidence omits raw source/Wasm bytes and sensitive retrieval
credentials. Build stdout/stderr are retained within limits: arbitrary build
scripts can print sensitive content of their own. Review logs before publishing
them. Evidence is a snapshot of a run; later contract upgrades or
external-reference changes require new verification.
