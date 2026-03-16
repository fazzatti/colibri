<div align="center">
  <a href="https://jsr.io/@colibri/core" title="@Colibri/core">
    <img alt="@Colibri" src="./_internal/img/colibri-logo-light.jpg" alt="Colibri Logo" width="300" />
  </a>
  <br />
  <h1>@colibri</h1>
</div>

<p align="center">
A TypeScript-first toolkit for building robust Stellar and Soroban applications with deterministic error handling, composable workflows, and extensible plugin architecture.
</p>

<p align="center">
  <a href="https://colibri-docs.gitbook.io/">📚 Documentation</a> | <a href="https://github.com/fazzatti/colibri-examples">💡 Examples</a>
</p>

<div align="center">

  <a href="https://github.com/fazzatti/colibri/actions/workflows/deno.yml">
    <img src="https://github.com/fazzatti/colibri/actions/workflows/deno.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://codecov.io/gh/fazzatti/colibri" > 
    <img src="https://codecov.io/gh/fazzatti/colibri/branch/main/graph/badge.svg?token=QMVWNRZNWC"/> 
 </a>
  <a href="https://opensource.org/licenses/mit-license.php">
    <img alt="MIT Licence" src="https://badges.frapsoft.com/os/mit/mit.svg?v=103" />
  </a>
  <a href="https://github.com/ellerbrock/open-source-badge/">
    <img alt="Open Source Love" src="https://badges.frapsoft.com/os/v1/open-source.svg?v=103" />
  </a>
  
  
</div>

<br />

## Packages

### [@colibri/core](./core)

The foundation of the Colibri ecosystem. Provides pipelines, processes, and utilities for Stellar and Soroban workflows.

```sh
deno add jsr:@colibri/core
# or
npm install @colibri/core
```

[View Documentation →](./core/README.md)

---

### [@colibri/plugin-fee-bump](./plugins/fee-bump)

A plugin that enables fee sponsorship by wrapping transactions in Fee Bump Transactions.

```sh
deno add jsr:@colibri/plugin-fee-bump
# or
npm install @colibri/plugin-fee-bump
```

[View Documentation →](./plugins/fee-bump/README.md)

---

### [@colibri/rpc-streamer](./rpc-streamer)

A real-time event streaming client for Stellar/Soroban that supports live streaming, historical ingestion, and automatic mode switching.

```sh
deno add jsr:@colibri/rpc-streamer
# or
npm install @colibri/rpc-streamer
```

[View Documentation →](./rpc-streamer/README.md)

---

## Core Concepts & Standards

Colibri is designed around a specific mindset to ensure reliability and debuggability in blockchain applications. It is built on top of the **[Convee](https://jsr.io/@fifo/convee)** framework, leveraging its patterns for functional, railway-oriented programming.

### 1. Deterministic Error Handling

We do not throw generic errors. Every error in Colibri is a typed `ColibriError` containing:

- **Domain**: The logical area (e.g., `Pipeline`, `Process`, `Account`).
- **Code**: A stable, unique identifier (e.g., `PIPE_INVC_002`).
- **Meta**: Structured data relevant to the error context.
- **Diagnostic**: Human-readable suggestions for resolution.

### 2. Pipelines, Processes & Steps

The architecture separates orchestration from execution, promoting reusability and testability.

- **Processes (The "How")**: Atomic functions that do one thing well. They are plain reusable building blocks, independent from orchestration.

  - _Example:_ `signAuthEntries` takes Soroban auth entries plus signers and returns signed authorization entries.
  - _Example:_ `simulateTransaction` takes a transaction, sends it to the RPC, and returns simulation results.

- **Steps (The orchestration boundary)**: Thin `convee` wrappers around processes. They attach stable step ids, plugin targets, and runtime context without polluting the process layer.

- **Pipelines (The "What")**: Orchestrators that chain processes together to achieve a high-level business goal.
  - _Example:_ `PIPE_InvokeContract` composes build, simulate, sign-auth, assemble, envelope-signing-requirements, sign-envelope, and send steps into one write flow.

This composition allows us to swap parts easily. For instance, the `FeeBump` plugin targets the `SendTransaction` step and wraps the outgoing transaction before submission, without rewriting the rest of the pipeline.

### 3. Type Safety

Everything is strictly typed. From network configurations to error metadata, TypeScript is used to enforce correctness at compile time.

---

## Architecture

The system is built in layers, aiming to provide both high-level tools for specific use cases and highly specialized, bullet-proof building blocks.

- **Layer 4: Plugins, Clients & Streamers**
  - Extensions (Fee Bump), specialized clients (Contract, Signer), and event streaming.
- **Layer 3: Pipelines**
  - High-level workflows (`PIPE_InvokeContract`, `PIPE_ReadFromContract`).
- **Layer 2: Steps & Processes**
  - Plain process functions plus `convee` step wrappers with stable ids.
- **Layer 1: Core**
  - Base types, Error primitives, Network configurations, account wrappers, and shared auth/address utilities.

---

## Development

This workspace is a Deno monorepo. We use specific tasks defined in [`deno.json`](deno.json) to maintain quality.

### Testing

Run the test suite. You can run all tests or target specific types.

```sh
# Run all tests (Unit + Integration)
deno task test

# Run only unit tests
deno task test:unit

# Run only integration tests (requires network connection)
deno task test:integration
```

### Linting

Ensure code style consistency.

```sh
deno lint
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

**Status:** Beta (🪶)
