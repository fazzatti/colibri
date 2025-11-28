# Error Handling

All errors in Colibri extend `ColibriError`, providing consistent structure across the library: unique error codes, diagnostic information, and typed metadata.

## Error Shape

| Property     | Type          | Description                                 |
| ------------ | ------------- | ------------------------------------------- |
| `code`       | `string`      | Unique identifier (e.g., `"BTX_003"`)       |
| `message`    | `string`      | Human-readable description                  |
| `details`    | `string?`     | Additional context                          |
| `diagnostic` | `Diagnostic?` | Root cause, suggestion, and reference links |
| `meta`       | `object?`     | Error-specific data (input, cause)          |

## Catching Errors

Use `ColibriError.is()` to identify Colibri errors:

```typescript
import { ColibriError } from "@colibri/core";

try {
  await pipeline.run({...});
} catch (error) {
  if (ColibriError.is(error)) {
    console.log(error.code);    // "BTX_003"
    console.log(error.message); // "Could not load source account!"
  }
}
```

## Diagnostics

Errors include diagnostic information with actionable suggestions:

```typescript
if (ColibriError.is(error) && error.diagnostic) {
  console.log(error.diagnostic.rootCause);
  console.log(error.diagnostic.suggestion);
  console.log(error.diagnostic.materials); // Links to relevant docs
}
```

## Handling Specific Errors

Each module exports its error classes under a namespace (e.g., `BTX_ERRORS` for build-transaction). Use `instanceof` for typed access:

```typescript
import { BTX_ERRORS } from "@colibri/core";

if (error instanceof BTX_ERRORS.COULD_NOT_LOAD_ACCOUNT_ERROR) {
  console.log(error.meta.data.input.source); // Typed access to input
  console.log(error.meta.cause?.message); // Underlying error
}
```

Error classes are also indexed by code:

```typescript
const ErrorClass = BTX_ERRORS.ERROR_BY_CODE["BTX_003"];
if (error instanceof ErrorClass) {
  // ...
}
```

## Next Steps

- [Pipelines](pipelines/README.md) — Where most errors originate
- [Processes](processes/README.md) — Individual process documentation
