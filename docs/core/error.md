# Handle errors

Most Core, WebAuth, build-verification, identicon, and plugin failures use
`ColibriError` or a subclass. **RPC Streamer and Test Tooling have their own
`Error` subclasses** (`RPCStreamerError` and `QuickstartError`). RPC libraries
and application callbacks can also throw other values; do not assume every
caught error has a Colibri shape.

## The shared error shape

| Field        | Meaning                                                         |
| ------------ | --------------------------------------------------------------- |
| `domain`     | Broad area such as processes, pipelines, or tools               |
| `source`     | Owning module identifier, not necessarily an importable subpath |
| `code`       | Stable machine-readable condition                               |
| `message`    | Human-readable explanation; not a stable matching key           |
| `details`    | Optional additional context                                     |
| `diagnostic` | Optional root cause, suggestion, and reference links            |
| `meta`       | Domain-specific input, data, and/or original cause              |

`toJSON()` exposes the structured fields. Error metadata may contain transaction
inputs or other sensitive application data; redact it before sending logs to a
third party. Serialization alone is not a privacy guarantee.

## Narrow to a particular occurrence

<!-- deno-check -->

```ts
import { BTX_ERRORS, ColibriError } from "@colibri/core";

function report(error: unknown): void {
  if (error instanceof BTX_ERRORS.COULD_NOT_LOAD_ACCOUNT_ERROR) {
    console.error("Source lookup failed", error.meta.data.input.source);
    console.error(error.meta.cause?.message);
  } else if (ColibriError.is(error)) {
    console.error(error.source, error.code, error.message);
    console.error(error.diagnostic?.suggestion);
  } else {
    console.error("Non-Colibri failure", error);
  }
}
```

Pass a caught value to this handler. A code comparison is useful for application
routing; a concrete exported class/registry also gives typed metadata. Different
contexts may use different constructor names for the same conceptual condition.
Use the actual exported registry instead of inventing an import from a source
path.

## Recovery belongs to the caller

- Invalid configuration: correct input before retrying.
- Source/RPC lookup failure: inspect the underlying cause and the chosen
  network.
- Simulation/contract failure: inspect diagnostics and the contract's error
  enum.
- Submission timeout: query the existing transaction hash before constructing
  another transaction. A missing confirmation is not proof of non-execution.
- Build mismatch: a completed verification result, not an exception; compare its
  evidence before changing the recipe.

`ColibriError.fromUnknown()` preserves existing Colibri errors and wraps other
values. Its default fallback code is `GEN_000`; applications may supply their
own source/code. Do not collapse a known occurrence into that fallback.

## Complete references

[All error contexts](../reference/errors/README.md) lists every declared code in
the published package source. The references include declarations that are not
currently emitted and internal contexts that can surface through public calls.
They do not imply that every context has a root-exported constructor.

See [streamer recovery](../packages/rpc-streamer/recovery.md),
[WebAuth JWT/error handling](../packages/webauth/jwt.md), and
[Quickstart configuration](../packages/test-tooling/configuration.md) for their
package-specific boundaries.
