# Processes

Processes are the atomic building blocks of Colibri. Each process is a plain function with:

- **Clear inputs and outputs** — Typed interfaces for predictable behavior
- **Standardized errors** — Every failure is wrapped in a typed `ColibriError`
- **No orchestration coupling** — Processes do not depend on `convee`

## Process Structure

Each process is exported directly from `@colibri/core`:

```typescript
import { buildTransaction, BTX_ERRORS } from "@colibri/core";

const transaction = await buildTransaction(input);
```

If you need stable ids or plugin targets for orchestration, use the matching step wrapper from `steps` or one of the built-in [pipelines](../pipelines/README.md).

## When to Use Processes Directly

Use processes directly when you need:

- Fine-grained control over one operation
- Custom orchestration outside the built-in pipelines
- Direct unit testing of business logic
- A reusable function that should stay independent from pipeline/plugin concerns
