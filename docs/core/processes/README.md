# Processes

Processes are the atomic building blocks of Colibri. Each process is a plain
function with:

- **Clear inputs and outputs** — Typed interfaces for predictable behavior
- **Standardized errors** — Every failure is wrapped in a typed
  [`ColibriError`](../error.md)
- **No orchestration coupling** — Processes do not depend on `convee`

## Available processes

| Process                                                                | Responsibility                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| [BuildTransaction](build-transaction.md)                               | Build operations, fees and transaction preconditions      |
| [SimulateTransaction](simulate-transaction.md)                         | Obtain resource and authorization recommendations         |
| [SignAuthEntries](sign-auth-entries.md)                                | Sign contract authorization entries                       |
| [AssembleForEnforcement](assemble-for-enforcement.md)                  | Prepare delegated credentials for enforcement             |
| [EnforceSimulation](enforce-simulation.md)                             | Validate delegated authorization with a second simulation |
| [AssembleTransaction](assemble-transaction.md)                         | Apply final simulation data, resource controls and fees   |
| [EnvelopeSigningRequirements](envelope-signing-requirements.md)        | Resolve account thresholds and required signatures        |
| [SignEnvelope](sign-envelope.md)                                       | Authorize the final transaction envelope                  |
| [SendTransaction](send-transaction.md)                                 | Submit and wait for confirmation                          |
| [ParseClassicTransactionOutcome](parse-classic-transaction-outcome.md) | Decode confirmed classic operation results                |
| [WrapFeeBump](wrap-fee-bump.md)                                        | Wrap an inner transaction with a separate fee payer       |

## Process Structure

Each process is exported directly from [`@colibri/core`](../overview.md):

```typescript
import { BTX_ERRORS, buildTransaction } from "@colibri/core";

const transaction = await buildTransaction(input);
```

If you need stable ids or plugin targets for orchestration, use the matching
step wrapper from [`steps`](../steps.md#available-steps) or one of the built-in
[pipelines](../pipelines/README.md).

## When to Use Processes Directly

Use processes directly when you need:

- Fine-grained control over one operation
- Custom orchestration outside the built-in pipelines
- Direct unit testing of business logic
- A reusable function that should stay independent from pipeline/plugin concerns
