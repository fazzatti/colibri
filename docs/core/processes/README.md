# Processes

Processes are the atomic building blocks of Colibri. Each process is a single-purpose unit built on the [`convee`](https://jsr.io/@fifo/convee) library with:

- **Clear inputs and outputs** — Typed interfaces for predictable behavior
- **Standardized errors** — Every failure is wrapped in a typed `ColibriError` with diagnostics
- **Plugin extensibility** — Extend behavior via plugins that act on inputs, outputs, errors, or combinations

## Process Structure

Each process follows the same pattern:

```typescript
import { P_BuildTransaction } from "@colibri/core";

const process = P_BuildTransaction();

// Run standalone
const result = await process.run(input);

// Or add plugins
process.addPlugin(myPlugin, "onInput");
```

Plugins can hook into:

- `onInput` — Transform or validate input before execution
- `onOutput` — Transform or enrich output after execution
- `onError` — Handle or transform errors
- Combinations of the above

## Available Processes

| Process                                                         | Description                                            |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| [BuildTransaction](build-transaction.md)                        | Creates a transaction from operations                  |
| [SimulateTransaction](simulate-transaction.md)                  | Simulates transaction on RPC to get resource estimates |
| [AssembleTransaction](assemble-transaction.md)                  | Attaches simulation results to a transaction           |
| [SignAuthEntries](sign-auth-entries.md)                         | Signs Soroban authorization entries                    |
| [EnvelopeSigningRequirements](envelope-signing-requirements.md) | Determines which signatures a transaction needs        |
| [SignEnvelope](sign-envelope.md)                                | Signs the transaction envelope                         |
| [SendTransaction](send-transaction.md)                          | Submits transaction and waits for confirmation         |
| [WrapFeeBump](wrap-fee-bump.md)                                 | Wraps a transaction with a fee bump                    |

## When to Use Processes Directly

For most use cases, use [Pipelines](../pipelines/README.md) which compose these processes automatically. Use processes directly when you need:

- Fine-grained control over individual steps
- Custom process ordering
- To build your own pipelines
- To run a single step in isolation
