# Contract

The Contract module provides a high-level interface for working with Soroban smart contracts, including deployment, invocation, and state reading.

## Contract Class

The `Contract` class is the main interface for interacting with Soroban contracts.

### Creating a Contract Instance

```typescript
import { Contract, NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();

// Create from existing contract ID
const contract = new Contract({
  networkConfig: network,
  contractConfig: {
    contractId: "CABC..." as ContractId,
  },
});

// Create from WASM buffer
const contractFromWasm = new Contract({
  networkConfig: network,
  contractConfig: {
    wasm: wasmBuffer,
  },
});

// Create from WASM hash
const contractFromHash = new Contract({
  networkConfig: network,
  contractConfig: {
    wasmHash: "abc123...",
  },
});

// Optionally provide a custom RPC server
import { Server } from "stellar-sdk/rpc";
const customRpc = new Server("https://custom-rpc.example.com");

const contractWithCustomRpc = new Contract({
  networkConfig: network,
  rpc: customRpc,
  contractConfig: {
    contractId: "CABC..." as ContractId,
  },
});
```

{% hint style="info" %}
For Stellar Asset Contracts (SAC), use the dedicated `StellarAssetContract` class instead. See [Stellar Asset Contract](asset/stellar-asset-contract.md).
{% endhint %}

## Contract Methods

### Getters

#### `getContractId()`

Returns the contract ID (requires contract to have an ID):

```typescript
const contractId = contract.getContractId();
```

#### `getSpec()`

Returns the contract specification (requires spec to be loaded):

```typescript
const spec = contract.getSpec();
```

#### `getWasm()`

Returns the WASM buffer (requires WASM to be loaded):

```typescript
const wasm = contract.getWasm();
```

#### `getWasmHash()`

Returns the WASM hash:

```typescript
const wasmHash = contract.getWasmHash();
```

#### `getContractFootprint()`

Returns the ledger key for the contract:

```typescript
const footprint = contract.getContractFootprint();
```

#### `getContractCodeLedgerEntry()`

Fetches the contract code entry from the network:

```typescript
const codeEntry = await contract.getContractCodeLedgerEntry();
```

#### `getContractInstanceLedgerEntry()`

Fetches the contract instance entry from the network:

```typescript
const instanceEntry = await contract.getContractInstanceLedgerEntry();
```

## Invoking Contract Methods

### `invoke()` - State-Changing Calls

For methods that modify contract state:

```typescript
const result = await contract.invoke({
  method: "transfer",
  methodArgs: {
    from: "GABC...",
    to: "GDEF...",
    amount: 1000000n,
  },
  config: {
    fee: "10000000",
    timeout: 30,
    source: signer.publicKey(),
    signers: [signer],
  },
});
```

### `read()` - Read-Only Calls

For methods that only read state (no transaction required):

```typescript
const balance = await contract.read({
  method: "balance",
  methodArgs: {
    id: "GABC...",
  },
});
```

### `invokeRaw()` - Low-Level Invocation

For passing pre-encoded ScVal arguments:

```typescript
import { xdr, nativeToScVal } from "stellar-sdk";

const result = await contract.invokeRaw({
  operationArgs: {
    function: "transfer",
    args: [
      nativeToScVal(fromAddress, { type: "address" }),
      nativeToScVal(toAddress, { type: "address" }),
      nativeToScVal(1000000n, { type: "i128" }),
    ],
  },
  config: {
    fee: "10000000",
    timeout: 30,
    source: signer.publicKey(),
    signers: [signer],
  },
});
```

### `readRaw()` - Low-Level Read

For reading with pre-encoded ScVal arguments:

```typescript
const result = await contract.readRaw({
  method: "balance",
  methodArgs: [nativeToScVal(address, { type: "address" })],
});
```

## Deploying Contracts

### `uploadWasm()`

Upload WASM to the network:

```typescript
const uploadResult = await contract.uploadWasm({
  fee: "10000000",
  timeout: 30,
  source: signer.publicKey(),
  signers: [signer],
});

// WASM hash is now stored in the contract instance
const wasmHash = contract.getWasmHash();
```

### `deploy()`

Deploy a contract from an uploaded WASM hash:

```typescript
const deployResult = await contract.deploy({
  config: {
    fee: "10000000",
    timeout: 30,
    source: signer.publicKey(),
    signers: [signer],
  },
  constructorArgs: {
    // Optional constructor arguments
    owner: adminAddress,
  },
});

const deployedContractId = contract.getContractId();
```

## Loading Contract Metadata

### `loadSpecFromWasm()`

Extract and load the contract specification from a local WASM buffer:

```typescript
// Requires WASM to be set in contractConfig
await contract.loadSpecFromWasm();
const spec = contract.getSpec();
```

### `loadSpecFromDeployedContract()`

Load the contract specification from an on-chain deployed contract:

```typescript
// Requires wasmHash or contractId to be set
await contract.loadSpecFromDeployedContract();
const spec = contract.getSpec();
```

### `loadWasmHashFromContractInstance()`

Load the WASM hash from an on-chain contract instance:

```typescript
// Requires contractId to be set
await contract.loadWasmHashFromContractInstance();
const wasmHash = contract.getWasmHash();
```

## Contract Types

### ContractId

A branded string type for contract IDs:

```typescript
type ContractId = string & { __brand: "ContractId" };
```

Contract IDs always start with `C` and are 56 characters long.

### Validating Contract IDs

```typescript
import { StrKey } from "@colibri/core/strkeys";

const input = "CABC...";

if (StrKey.isValidContractId(input)) {
  // Valid contract ID
}
```

## Using Pipelines Directly

For more control, use pipelines directly:

### `PIPE_InvokeContract`

```typescript
import { PIPE_InvokeContract, NetworkConfig, LocalSigner } from "@colibri/core";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("SXXX...");

const pipeline = PIPE_InvokeContract.create({
  networkConfig: network,
});

const operation = Operation.invokeContractFunction({
  contract: "CABC...",
  function: "transfer",
  args: [...],
});

const result = await pipeline.run({
  operations: [operation],
  config: {
    source: signer.publicKey(),
    signers: [signer],
  },
});
```

### `PIPE_ReadFromContract`

```typescript
import { PIPE_ReadFromContract, NetworkConfig } from "@colibri/core";
import { Operation } from "stellar-sdk";

const pipeline = PIPE_ReadFromContract.create({
  networkConfig: network,
});

const result = await pipeline.run({
  operations: [operation],
});
```

## Errors

| Code        | Class                         | Description                                |
| ----------- | ----------------------------- | ------------------------------------------ |
| `CONTR_001` | `MISSING_ARG`                 | Required argument not provided             |
| `CONTR_002` | `MISSING_RPC_URL`             | RPC URL required but not provided          |
| `CONTR_003` | `INVALID_CONTRACT_CONFIG`     | Must provide contractId, wasm, or wasmHash |
| `CONTR_004` | `FAILED_TO_UPLOAD_WASM`       | WASM upload to network failed              |
| `CONTR_005` | `MISSING_REQUIRED_PROPERTY`   | Required contract property not set         |
| `CONTR_006` | `PROPERTY_ALREADY_SET`        | Property is immutable once set             |
| `CONTR_007` | `MISSING_SPEC_IN_WASM`        | WASM doesn't contain valid spec            |
| `CONTR_008` | `FAILED_TO_DEPLOY_CONTRACT`   | Contract deployment failed                 |
| `CONTR_009` | `CONTRACT_INSTANCE_NOT_FOUND` | Contract instance not found on network     |
| `CONTR_010` | `CONTRACT_CODE_NOT_FOUND`     | Contract code not found on network         |
| `CONTR_011` | `INVALID_CONTRACT_ID`         | Invalid contract ID format                 |

```typescript
import { ContractError } from "@colibri/core";

try {
  const contract = new Contract({ networkConfig, contractConfig });
  await contract.deploy({ config });
} catch (error) {
  if (error instanceof ContractError.MISSING_ARG) {
    console.error("Missing argument:", error.meta.data.argName);
  }
  if (error instanceof ContractError.FAILED_TO_DEPLOY_CONTRACT) {
    console.error("Deployment failed:", error.message);
    console.error("Cause:", error.meta.cause);
  }
}
```

## Next Steps

- [Pipelines](pipelines/README.md) — Full pipeline documentation
- [Processes](processes/README.md) — Individual process details
- [Network](network.md) — Network configuration
