# Stellar Asset Contract

The `StellarAssetContract` class provides a high-level client for interacting with Stellar Asset Contracts (SAC), which bridge classic Stellar assets with Soroban smart contracts.

SACs implement the [SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) token interface and are defined in [CAP-0046-06](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md).

## Overview

Stellar Asset Contracts enable classic Stellar assets (like USDC, XLM, or any issued asset) to be used within Soroban smart contracts. The contract ID is deterministically derived from the asset code, issuer, and network passphrase.

## Creating a SAC Instance

```typescript
import { StellarAssetContract, NetworkConfig } from "@colibri/core";

const sac = new StellarAssetContract({
  code: "USDC",
  issuer: "GCNY5OXYSY4FKHOPT2SPOQZAOEIGXB5LBYW3HVU3OWSTQITS65M5RCNY",
  networkConfig: NetworkConfig.TestNet(),
});

// The contract ID is automatically calculated
console.log("Contract ID:", sac.contractId);
```

## Deploying the Contract

Before using the SAC, it must be deployed on the network. This operation creates the Stellar Asset Contract for the classic asset:

```typescript
import { LocalSigner } from "@colibri/core";

const signer = LocalSigner.fromSecret("SXXX...");

await sac.deploy({
  fee: "10000000",
  timeout: 30,
  source: signer.publicKey(),
  signers: [signer],
});

console.log("SAC deployed successfully!");
```

{% hint style="info" %}
If the contract has already been deployed, `deploy()` will detect the existing contract and return successfully without throwing an error.
{% endhint %}

## Reading Token Information

### Metadata

```typescript
// Get token decimals (always 7 for SAC)
const decimals = await sac.decimals();
console.log(decimals); // 7

// Get token name (returns "CODE:ISSUER" format)
const name = await sac.name();
console.log(name); // "USDC:GCNY5OXYSY4FKHOPT2SPOQZAOEIGXB5LBYW3HVU3OWSTQITS65M5RCNY"

// Get token symbol (asset code)
const symbol = await sac.symbol();
console.log(symbol); // "USDC"
```

### Balances and Allowances

```typescript
// Check balance (returns bigint with 7 decimal places)
const balance = await sac.balance({ id: userAddress });
const humanReadable = Number(balance) / 10_000_000;
console.log(`Balance: ${humanReadable} tokens`);

// Check allowance
const allowance = await sac.allowance({
  from: ownerAddress,
  spender: spenderAddress,
});
console.log(`Allowance: ${allowance}`);

// Check authorization status
const isAuthorized = await sac.authorized({ id: userAddress });
console.log(`Authorized: ${isAuthorized}`);

// Get current admin
const admin = await sac.admin();
console.log(`Admin: ${admin}`);
```

## Token Operations

### Transfer

Transfer tokens from one address to another:

```typescript
await sac.transfer({
  from: senderAddress,
  to: recipientAddress,
  amount: 100_0000000n, // 100 tokens (7 decimals)
  config: {
    fee: "10000000",
    timeout: 30,
    source: senderAddress,
    signers: [senderSigner],
  },
});
```

### Approve

Set an allowance for delegated transfers:

```typescript
// Get current ledger for expiration calculation
const rpc = new Server(networkConfig.rpcUrl);
const currentLedger = (await rpc.getLatestLedger()).sequence;

await sac.approve({
  from: ownerAddress,
  spender: spenderAddress,
  amount: 1000_0000000n, // 1000 tokens
  expirationLedger: currentLedger + 1000, // ~83 minutes
  config: {
    fee: "10000000",
    timeout: 30,
    source: ownerAddress,
    signers: [ownerSigner],
  },
});
```

### Transfer From (Delegated)

Transfer tokens on behalf of another address using an allowance:

```typescript
await sac.transferFrom({
  spender: spenderAddress,
  from: ownerAddress,
  to: recipientAddress,
  amount: 50_0000000n, // 50 tokens
  config: {
    fee: "10000000",
    timeout: 30,
    source: spenderAddress,
    signers: [spenderSigner],
  },
});
```

### Burn

Destroy tokens (permanently remove from circulation):

```typescript
await sac.burn({
  from: holderAddress,
  amount: 100_0000000n,
  config: {
    fee: "10000000",
    timeout: 30,
    source: holderAddress,
    signers: [holderSigner],
  },
});
```

### Burn From (Delegated)

Burn tokens on behalf of another address:

```typescript
await sac.burnFrom({
  spender: spenderAddress,
  from: ownerAddress,
  amount: 25_0000000n,
  config: {
    fee: "10000000",
    timeout: 30,
    source: spenderAddress,
    signers: [spenderSigner],
  },
});
```

## Admin Operations

Admin operations require the current admin's authorization (initially the asset issuer).

### Mint

Create new tokens:

```typescript
await sac.mint({
  to: recipientAddress,
  amount: 1_000_000_0000000n, // 1,000,000 tokens
  config: {
    fee: "10000000",
    timeout: 30,
    source: adminAddress,
    signers: [adminSigner],
  },
});
```

### Set Admin

Transfer admin rights to a new address:

```typescript
await sac.setAdmin({
  newAdmin: newAdminAddress,
  config: {
    fee: "10000000",
    timeout: 30,
    source: currentAdminAddress,
    signers: [currentAdminSigner],
  },
});
```

### Set Authorized

Enable or disable authorization for an address (for assets with `AUTH_REQUIRED` flag):

```typescript
await sac.setAuthorized({
  id: userAddress,
  authorize: true, // or false to revoke
  config: {
    fee: "10000000",
    timeout: 30,
    source: adminAddress,
    signers: [adminSigner],
  },
});
```

### Clawback

Recover tokens from an address (for assets with `AUTH_CLAWBACK_ENABLED` flag):

```typescript
await sac.clawback({
  from: targetAddress,
  amount: 500_0000000n,
  config: {
    fee: "10000000",
    timeout: 30,
    source: adminAddress,
    signers: [adminSigner],
  },
});
```

## Method Reference

### Read Methods

| Method                         | Parameters | Returns   | Description                  |
| ------------------------------ | ---------- | --------- | ---------------------------- |
| `decimals()`                   | —          | `number`  | Returns decimals (always 7)  |
| `name()`                       | —          | `string`  | Returns "CODE:ISSUER" format |
| `symbol()`                     | —          | `string`  | Returns asset code           |
| `balance({ id })`              | address    | `bigint`  | Returns balance              |
| `allowance({ from, spender })` | addresses  | `bigint`  | Returns remaining allowance  |
| `authorized({ id })`           | address    | `boolean` | Returns authorization status |
| `admin()`                      | —          | `string`  | Returns admin address        |

### Invoke Methods

| Method                                                         | Parameters                        | Description        |
| -------------------------------------------------------------- | --------------------------------- | ------------------ |
| `approve({ from, spender, amount, expirationLedger, config })` | addresses, amount, ledger, config | Sets allowance     |
| `transfer({ from, to, amount, config })`                       | addresses, amount, config         | Transfers tokens   |
| `transferFrom({ spender, from, to, amount, config })`          | addresses, amount, config         | Delegated transfer |
| `burn({ from, amount, config })`                               | address, amount, config           | Burns tokens       |
| `burnFrom({ spender, from, amount, config })`                  | addresses, amount, config         | Delegated burn     |

### Admin Methods

| Method                                     | Parameters               | Description            |
| ------------------------------------------ | ------------------------ | ---------------------- |
| `setAdmin({ newAdmin, config })`           | address, config          | Transfers admin rights |
| `setAuthorized({ id, authorize, config })` | address, boolean, config | Sets authorization     |
| `mint({ to, amount, config })`             | address, amount, config  | Creates new tokens     |
| `clawback({ from, amount, config })`       | address, amount, config  | Recovers tokens        |

## Properties

| Property     | Type               | Description                      |
| ------------ | ------------------ | -------------------------------- |
| `code`       | `string`           | The asset code                   |
| `issuer`     | `Ed25519PublicKey` | The issuer's public key          |
| `contractId` | `ContractId`       | The deterministic contract ID    |
| `contract`   | `Contract`         | The underlying Contract instance |

## Errors

| Code      | Class                   | Description                        |
| --------- | ----------------------- | ---------------------------------- |
| `SAC_001` | `FAILED_TO_WRAP_ASSET`  | Asset contract deployment failed   |
| `SAC_002` | `UNMATCHED_CONTRACT_ID` | Deployed ID doesn't match expected |
| `SAC_003` | `MISSING_RETURN_VALUE`  | Contract method returned no value  |

```typescript
import { SACError } from "@colibri/core";

try {
  await sac.deploy(config);
} catch (error) {
  if (error instanceof SACError.FAILED_TO_WRAP_ASSET) {
    console.error("Deployment failed:", error.message);
  }
  if (error instanceof SACError.UNMATCHED_CONTRACT_ID) {
    console.error("Expected:", error.meta.data.expected);
    console.error("Received:", error.meta.data.deployed);
  }
}
```

## Notes

- **Decimals**: All SACs use 7 decimal places, matching classic Stellar assets
- **Amounts**: All amounts are `bigint` values. Multiply human-readable amounts by `10_000_000n`
- **Authorization**: The `from` address must sign/authorize most operations
- **Admin**: Initially the asset issuer; can be transferred via `setAdmin`
- **Deterministic IDs**: Contract IDs are deterministically derived from the asset and network

## See Also

- [SEP-11](sep-11.md) — Asset string format
- [Contract](../contract.md) — General contract interactions
- [SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) — Token interface spec
- [CAP-0046-06](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md) — SAC spec
