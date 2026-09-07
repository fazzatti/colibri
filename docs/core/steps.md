# Steps

Steps are thin [`convee`](https://jsr.io/@fifo/convee) wrappers around Colibri's
raw [processes](processes/README.md).

They exist to keep a clean boundary:

- **Processes** hold the business logic
- **Steps** add stable ids for orchestration
- **Pipelines** compose those steps into reusable flows

## What Steps Provide

Each exported step gives you two things:

- a factory such as `steps.createBuildTransactionStep()`
- a stable id such as `steps.BUILD_TRANSACTION_STEP_ID`

Use the factory when composing your own `convee` pipes. Use the id when
targeting a step from a plugin.

```typescript
import { steps } from "@colibri/core";

const BuildTransaction = steps.createBuildTransactionStep();

console.log(steps.BUILD_TRANSACTION_STEP_ID);
// "build-transaction"
```

Factories return fresh step instances, which keeps pipelines and tests isolated
from each other.

Step declarations use Convee 2's argument tuples. For a wrapper around a process,
the input generic is `Parameters<typeof process>`, not its first element
`Parameters<typeof process>[0]`. This preserves union-typed inputs and the exact
function signature. It does **not** add an array to the call: a process that takes
one input object still runs as `executeStep(input)`, not `executeStep([input])`.

## Available Steps

| Factory                                      | Id                                          |
| -------------------------------------------- | ------------------------------------------- |
| `createBuildTransactionStep()`               | `BUILD_TRANSACTION_STEP_ID`                 |
| `createSimulateTransactionStep()`            | `SIMULATE_TRANSACTION_STEP_ID`              |
| `createSignAuthEntriesStep()`                | `SIGN_AUTH_ENTRIES_STEP_ID`                 |
| `createAssembleForEnforcementStep()`         | `ASSEMBLE_FOR_ENFORCEMENT_STEP_ID`          |
| `createEnforceSimulationStep()`              | `ENFORCE_SIMULATION_STEP_ID`                |
| `createAssembleTransactionStep()`            | `ASSEMBLE_TRANSACTION_STEP_ID`              |
| `createEnvelopeSigningRequirementsStep()`    | `ENVELOPE_SIGNING_REQUIREMENTS_STEP_ID`     |
| `createSignEnvelopeStep()`                   | `SIGN_ENVELOPE_STEP_ID`                     |
| `createSendTransactionStep()`                | `SEND_TRANSACTION_STEP_ID`                  |
| `createParseClassicTransactionOutcomeStep()` | `PARSE_CLASSIC_TRANSACTION_OUTCOME_STEP_ID` |
| `createWrapFeeBumpStep()`                    | `WRAP_FEE_BUMP_STEP_ID`                     |

## When to Use Steps

Reach for steps when you want to:

- build a custom pipeline with `convee`
- target a Colibri step from a plugin
- keep your process layer plain while still exposing orchestration ids

If you just need the underlying behavior, call the raw process function
directly.
