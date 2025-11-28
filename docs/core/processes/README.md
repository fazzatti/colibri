# Processes

Processes are the atomic building blocks of Colibri's transaction pipelines. Each process performs a single task and can be composed into larger workflows.

For most use cases, use [Pipelines](../pipelines/README.md) which compose these processes automatically. Use processes directly when you need fine-grained control.

## Available Processes

| Process                 | Description                           |
| ----------------------- | ------------------------------------- |
| `P_BuildTransaction`    | Create a transaction from operations  |
| `P_SimulateTransaction` | Simulate transaction on RPC           |
| `P_AssembleTransaction` | Add simulation results to transaction |
| `P_SignAuthEntries`     | Sign Soroban authorization entries    |
| `P_SignEnvelope`        | Sign the transaction envelope         |
| `P_SendTransaction`     | Submit to the network and wait        |
| `P_WrapFeeBump`         | Wrap transaction with fee bump        |

## P_BuildTransaction

Creates a transaction from operations.

```typescript
import { P_BuildTransaction } from "@colibri/core";
import { Operation } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";

const result = await P_BuildTransaction().run({
  operations: [Operation.invokeContractFunction({...})],
  source: "GABC...",
  baseFee: "100000",
  networkPassphrase: "Test SDF Network ; September 2015",
  rpc: new Server("https://soroban-testnet.stellar.org"),
});
```

**Input:**
- `operations` — Array of `xdr.Operation`
- `source` — Source account public key
- `baseFee` — Fee in stroops
- `networkPassphrase` — Network passphrase
- `rpc` — RPC server (or provide `sequence` directly)

**Output:** `Transaction`

## P_SimulateTransaction

Simulates a transaction to calculate resource usage and fees.

```typescript
import { P_SimulateTransaction } from "@colibri/core";

const result = await P_SimulateTransaction().run({
  transaction: builtTx,
  rpc: rpcServer,
});
```

**Input:**
- `transaction` — Built transaction
- `rpc` — RPC server

**Output:** `SimulateTransactionSuccessResponse` or `SimulateTransactionRestoreResponse`

## P_AssembleTransaction

Adds simulation results (footprint, auth entries, resource fees) to a transaction.

```typescript
import { P_AssembleTransaction } from "@colibri/core";

const result = await P_AssembleTransaction().run({
  transaction: builtTx,
  simulation: simulationResponse,
});
```

**Input:**
- `transaction` — Built transaction
- `simulation` — Successful simulation response

**Output:** `Transaction` (with soroban data attached)

## P_SignAuthEntries

Signs Soroban authorization entries for contract calls requiring authorization.

```typescript
import { P_SignAuthEntries } from "@colibri/core";

const result = await P_SignAuthEntries().run({
  authEntries: simulation.result?.auth || [],
  signers: [signer],
  networkPassphrase: "Test SDF Network ; September 2015",
  validUntilLedgerSeq: currentLedger + 100,
});
```

**Input:**
- `authEntries` — Authorization entries from simulation
- `signers` — Array of signers
- `networkPassphrase` — Network passphrase
- `validUntilLedgerSeq` — Expiration ledger for auth

**Output:** Signed `SorobanAuthorizationEntry[]`

## P_SignEnvelope

Signs the transaction envelope.

```typescript
import { P_SignEnvelope } from "@colibri/core";

const result = await P_SignEnvelope().run({
  transaction: assembledTx,
  signers: [signer],
  requirements: { requiresSourceSignature: true, authSigners: [] },
});
```

**Input:**
- `transaction` — Assembled transaction
- `signers` — Array of signers
- `requirements` — Signing requirements

**Output:** Signed `Transaction` or `FeeBumpTransaction`

## P_SendTransaction

Submits a signed transaction and waits for confirmation.

```typescript
import { P_SendTransaction } from "@colibri/core";

const result = await P_SendTransaction().run({
  transaction: signedTx,
  rpc: rpcServer,
  options: { timeoutInSeconds: 45 },
});

console.log("TX Hash:", result.hash);
console.log("Return Value:", result.returnValue);
```

**Input:**
- `transaction` — Signed transaction
- `rpc` — RPC server
- `options` — Optional timeout settings

**Output:**
- `hash` — Transaction hash
- `returnValue` — Contract return value (if any)
- `response` — Full transaction response

## P_WrapFeeBump

Wraps a transaction with a fee bump for fee sponsorship.

```typescript
import { P_WrapFeeBump } from "@colibri/core";

const result = await P_WrapFeeBump().run({
  transaction: innerTx,
  config: {
    source: sponsorPublicKey,
    fee: "200000",
  },
  networkPassphrase: "Test SDF Network ; September 2015",
});
```

**Input:**
- `transaction` — Inner transaction to wrap
- `config` — Fee bump configuration (source, fee)
- `networkPassphrase` — Network passphrase

**Output:** `FeeBumpTransaction`

See also: [Fee Bump Plugin](../../packages/plugin-fee-bump.md)
