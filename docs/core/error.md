# Error Handling

Colibri uses a structured error system where all errors extend the `ColibriError` class with typed error codes and diagnostic information.

## ColibriError Class

All errors in Colibri extend `ColibriError`:

```typescript
import { ColibriError } from "@colibri/core";

class ColibriError<C extends string, M extends BaseMeta> extends Error {
  readonly domain: ErrorDomain;  // "core", "event-streamer", etc.
  readonly code: C;              // Unique error identifier
  readonly source: string;       // Module that threw the error
  readonly details?: string;     // Additional context
  readonly diagnostic?: Diagnostic;  // Help for debugging
  readonly meta?: M;             // Error-specific metadata
}
```

### Error Properties

| Property     | Type          | Description                                  |
| ------------ | ------------- | -------------------------------------------- |
| `domain`     | `string`      | Package domain (e.g., "core")                |
| `code`       | `string`      | Unique identifier (e.g., "BTX_003")          |
| `source`     | `string`      | Module path that threw the error             |
| `message`    | `string`      | Human-readable description                   |
| `details`    | `string?`     | Additional context about the error           |
| `diagnostic` | `Diagnostic?` | Debugging help (root cause, suggestion, links) |
| `meta`       | `object?`     | Error-specific data                          |

## Checking Errors

```typescript
import { ColibriError } from "@colibri/core";

try {
  await pipeline.run({...});
} catch (error) {
  if (ColibriError.is(error)) {
    console.log("Code:", error.code);
    console.log("Message:", error.message);
    console.log("Details:", error.details);
    console.log("Source:", error.source);
  }
}
```

## The `assert` Function

Use `assert` to validate conditions and throw typed errors:

```typescript
import { assert } from "@colibri/core";

function processAmount(amount: bigint) {
  assert(amount > 0n, new ERRORS.INVALID_AMOUNT(amount));
  
  // If we get here, amount is guaranteed > 0
}
```

If the condition is `false`, the provided error is thrown.

## Diagnostic Information

Colibri errors include diagnostic info to help debug issues:

```typescript
error.diagnostic = {
  rootCause: "The source account does not exist on the network.",
  suggestion: "Ensure the account is funded before submitting transactions.",
  materials: [
    "https://developers.stellar.org/docs/tutorials/create-account"
  ]
};
```

## Handling Pipeline Errors

```typescript
import { PIPE_InvokeContract, ColibriError, NetworkConfig, LocalSigner } from "@colibri/core";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("S...");

try {
  const pipeline = PIPE_InvokeContract.create({ networkConfig: network });
  const result = await pipeline.run({...});
  console.log("Success:", result.hash);
} catch (error) {
  if (ColibriError.is(error)) {
    console.log("Error code:", error.code);
    console.log("Message:", error.message);
    
    if (error.diagnostic) {
      console.log("Root cause:", error.diagnostic.rootCause);
      console.log("Suggestion:", error.diagnostic.suggestion);
    }
  }
}
```

## Creating Unexpected Errors

Wrap unknown errors with `ColibriError.fromUnknown`:

```typescript
try {
  await riskyOperation();
} catch (e) {
  throw ColibriError.fromUnknown(e, {
    domain: "core",
    source: "my-module",
    code: "MY_001",
  });
}
```

Or create an unexpected error with `ColibriError.unexpected`:

```typescript
throw ColibriError.unexpected({
  domain: "core",
  source: "my-module",
  message: "Something went wrong",
  cause: originalError,
});
```

## Error Code Format

Error codes follow the pattern `PREFIX_NNN`:

- **Prefix** — Identifies the module (e.g., `BTX` for build-transaction)
- **Number** — Three-digit identifier within the module

Examples:
- `BTX_003` — Build transaction: could not load account
- `SIM_001` — Simulate: simulation failed
- `ACC_NAT_001` — Native account: invalid public key

## Best Practices

### Use Error Codes for Logic

```typescript
// ❌ Bad - string matching is fragile
if (error.message.includes("not found")) { ... }

// ✅ Good - use typed error codes
if (error.code === "BTX_003") { ... }
```

### Check Error Types

```typescript
// ✅ Use the static type guard
if (ColibriError.is(error)) {
  // TypeScript knows error is ColibriError
  console.log(error.code);
}
```

### Log Diagnostics in Development

```typescript
if (ColibriError.is(error) && error.diagnostic) {
  console.log("Debug info:", error.diagnostic);
  console.log("Learn more:", error.diagnostic.materials);
}
```
