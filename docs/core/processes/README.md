# Processes

Processes are the atomic building blocks of Colibri. Each process is a single-purpose unit built on the [`convee`](https://jsr.io/@fifo/convee) library with:

- **Clear inputs and outputs** — Typed interfaces for predictable behavior
- **Standardized errors** — Every failure is wrapped in a typed `ColibriError` with diagnostics
- **Plugin extensibility** — Extend behavior via plugins that act on inputs, outputs, errors, or combinations

In Colibri, all processes are prefixed with `P_` (e.g., `P_BuildTransaction`).

## Process Structure

Each process follows the same pattern:

```typescript
import { P_BuildTransaction } from "@colibri/core";

const process = P_BuildTransaction();

// Run standalone
const result = await process.run(input);

// Or add plugins
process.addPlugin(handleErrorGraciouslyPlugin);
```

Plugins can hook into:

- `processInput` — Transform or validate input before execution
- `processOutput` — Transform or enrich output after execution
- `processError` — Handle or transform errors
- Combinations of the above

## When to Use Processes Directly

For most use cases, use [Pipelines](../pipelines/README.md) which compose these processes automatically. Use processes directly when you need:

- Fine-grained control over individual steps
- Custom process ordering
- To build your own pipelines
- To run a single step in isolation
