# Contract

The Contract module provides a high-level interface for working with Soroban smart contracts, including deployment, invocation, and state reading.

## Contract Class

The `Contract` class is the main interface for interacting with Soroban contracts.

### Creating a Contract Instance

```typescript
import { Contract, NetworkConfig } from "@colibri/core";
import { Server } from "stellar-sdk/rpc";

const network = NetworkConfig.TestNet();
const rpc = new Server(network.rpcUrl);

// Create from existing contract ID
const contract = Contract.create({
  networkConfig: network,
  rpc,
  contractConfig: {
    contractId: "CABC..." as ContractId,
  },
});

// Create from WASM buffer
const contractFromWasm = Contract.create({
  networkConfig: network,
  rpc,
  contractConfig: {
    wasm: wasmBuffer,
  },
});

// Create from WASM hash
const contractFromHash = Contract.create({
  networkConfig: network,
  rpc,
  contractConfig: {
    wasmHash: "abc123...",
  },
});
```

### Wrapping Stellar Assets

Create a Stellar Asset Contract (SAC) for classic assets:

```typescript
import { Contract, NetworkConfig, LocalSigner } from "@colibri/core";
import { Asset } from "stellar-sdk";

const signer = LocalSigner.fromSecret("SXXX...");

const sacContract = await Contract.wrapAssetAndInitialize({
  networkConfig: network,
  asset: new Asset(
    "USDC",
    "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
  ),
  config: {
    source: signer.publicKey(),
    signers: [signer],
  },
});
```

## Contract Methods

### `getContractId()`

Returns the contract ID (requires contract to have an ID):

```typescript
const contractId = contract.getContractId();
```

### `getSpec()`

Returns the contract specification (requires spec to be loaded):

```typescript
const spec = contract.getSpec();
```

### `getWasm()`

Returns the WASM buffer (requires WASM to be loaded):

```typescript
const wasm = contract.getWasm();
```

### `getWasmHash()`

Returns the WASM hash:

```typescript
const wasmHash = contract.getWasmHash();
```

### `getContractFootprint()`

Returns the ledger key for the contract:

```typescript
const footprint = contract.getContractFootprint();
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
import { xdr } from "stellar-sdk";

const result = await contract.invokeRaw({
  operationArgs: {
    function: "transfer",
    args: [
      xdr.ScVal.scvAddress(...),
      xdr.ScVal.scvAddress(...),
      xdr.ScVal.scvI128(...),
    ],
  },
  config: {
    source: signer.publicKey(),
    signers: [signer],
  },
});
```

## Deploying Contracts

### `uploadWasm()`

Upload WASM to the network:

```typescript
const uploadResult = await contract.uploadWasm({
  source: signer.publicKey(),
  signers: [signer],
});
```

### `deploy()`

Deploy a contract from an uploaded WASM hash:

```typescript
const deployResult = await contract.deploy({
  config: {
    source: signer.publicKey(),
    signers: [signer],
  },
  constructorArgs: {
    /* optional constructor args */
  },
});

const deployedContractId = contract.getContractId();
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
import { StrKey } from "@colibri/core";

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
| `CONTR_000` | `UNEXPECTED_ERROR`            | An unexpected error occurred               |
| `CONTR_001` | `MISSING_ARG`                 | Required argument not provided             |
| `CONTR_002` | `MISSING_RPC_URL`             | RPC URL required but not provided          |
| `CONTR_003` | `INVALID_CONTRACT_CONFIG`     | Must provide contractId, wasm, or wasmHash |
| `CONTR_004` | `FAILED_TO_UPLOAD_WASM`       | WASM upload to network failed              |
| `CONTR_005` | `MISSING_REQUIRED_PROPERTY`   | Required contract property not set         |
| `CONTR_006` | `PROPERTY_ALREADY_SET`        | Property is immutable once set             |
| `CONTR_007` | `MISSING_SPEC_IN_WASM`        | WASM doesn't contain valid spec            |
| `CONTR_008` | `FAILED_TO_DEPLOY_CONTRACT`   | Contract deployment failed                 |
| `CONTR_009` | `FAILED_TO_WRAP_ASSET`        | Asset wrapping failed                      |
| `CONTR_010` | `CONTRACT_INSTANCE_NOT_FOUND` | Contract instance not found                |
| `CONTR_011` | `CONTRACT_CODE_NOT_FOUND`     | Contract code not found                    |

## Next Steps

- [Pipelines](pipelines/README.md) — Full pipeline documentation
- [Processes](processes/README.md) — Individual process details
- [Network](network.md) — Network configuration
