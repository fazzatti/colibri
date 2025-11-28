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
  <a href="https://colibri-docs.gitbook.io/">📚 Documentation</a>
</p>

<div align="center">

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

### [@colibri/event-streamer](./event-streamer)

A real-time event streaming client for Stellar/Soroban that supports live streaming, historical ingestion, and automatic mode switching.

```sh
deno add jsr:@colibri/event-streamer
# or
npm install @colibri/event-streamer
```

[View Documentation →](./event-streamer/README.md)

---

## Core Concepts & Standards

Colibri is designed around a specific mindset to ensure reliability and debuggability in blockchain applications. It is built on top of the **[Convee](https://jsr.io/@fifo/convee)** framework, leveraging its patterns for functional, railway-oriented programming.

### 1. Deterministic Error Handling

We do not throw generic errors. Every error in Colibri is a typed `ColibriError` containing:

- **Domain**: The logical area (e.g., `Pipeline`, `Process`, `Account`).
- **Code**: A stable, unique identifier (e.g., `PIPE_INVC_002`).
- **Meta**: Structured data relevant to the error context.
- **Diagnostic**: Human-readable suggestions for resolution.

### 2. Pipelines & Processes

The architecture separates orchestration from execution, promoting reusability and testability.

- **Processes (The "How")**: Atomic, stateless units of work. They focus on doing one thing well.

  - _Example:_ `P_SignAuthEntries` takes a transaction and a signer, and produces signed authorization entries. It doesn't care where the transaction came from or what happens next.
  - _Example:_ `P_SimulateTransaction` takes a transaction, sends it to the RPC, and returns the simulation results (or a specific error if simulation fails).

- **Pipelines (The "What")**: Orchestrators that chain processes together to achieve a high-level business goal.
  - _Example:_ `PIPE_InvokeContract` is a pipeline composed of several processes:
    1.  `P_BuildTransaction` (Create the XDR)
    2.  `P_SimulateTransaction` (Check if it's valid)
    3.  `P_AssembleTransaction` (Apply simulation data)
    4.  `P_SignEnvelope` (Gather signatures)
    5.  `P_SendTransaction` (Submit to network)

This composition allows us to swap parts easily. For instance, a `FeeBump` plugin simply injects a `P_WrapFeeBump` process into the pipeline before the signing phase, without rewriting the core logic.

### 3. Type Safety

Everything is strictly typed. From network configurations to error metadata, TypeScript is used to enforce correctness at compile time.

---

## Architecture

The system is built in layers, aiming to provide both high-level tools for specific use cases and highly specialized, bullet-proof building blocks.

- **Layer 4: Plugins, Clients & Streamers**
  - Extensions (Fee Bump), specialized clients (Contract, Signer), and event streaming.
- **Layer 3: Pipelines**
  - High-level workflows (`PIPE_InvokeContract`, `PIPE_ReadFromContract`).
- **Layer 2: Processes**
  - Atomic logic blocks (`P_BuildTransaction`, `P_SimulateTransaction`).
- **Layer 1: Core**
  - Base types, Error primitives, Network configurations, and Account wrappers.

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

### Coverage

Generate and view test coverage reports.

```sh
deno task coverage:report
```

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

**Status:** Beta (🪶)
