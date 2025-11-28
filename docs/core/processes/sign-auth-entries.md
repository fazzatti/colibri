# SignAuthEntries

Signs Soroban authorization entries for contract calls that require authorization from specific accounts.

## `P_SignAuthEntries`

```typescript
import { P_SignAuthEntries } from "@colibri/core";

const result = await P_SignAuthEntries().run({
  auth: simulation.result?.auth || [],
  signers: [signer],
  rpc: rpcServer,
  networkPassphrase: "Test SDF Network ; September 2015",
});
```

## Input

| Property            | Type                          | Required | Description                            |
| ------------------- | ----------------------------- | -------- | -------------------------------------- |
| `auth`              | `SorobanAuthorizationEntry[]` | Yes      | Authorization entries from simulation  |
| `signers`           | `TransactionSigner[]`         | Yes      | Signers for the entries                |
| `rpc`               | `Server`                      | Yes      | RPC server (to get current ledger)     |
| `networkPassphrase` | `string`                      | Yes      | Network passphrase                     |
| `validity`          | `LedgerValidity`              | —        | How long signatures are valid          |
| `removeUnsigned`    | `boolean`                     | —        | Remove entries that couldn't be signed |

### Validity Options

```typescript
// Valid for N ledgers from current (default: 120 ledgers ≈ 10 min)
{
  validForLedgers: 120;
}

// Valid for N seconds from now
{
  validForSeconds: 600;
}

// Valid until specific ledger
{
  validUntilLedgerSeq: 12345678;
}
```

## Output

Returns `SorobanAuthorizationEntry[]` with signatures added to entries matching the provided signers.

## Behavior

The process:

1. Fetches current ledger from RPC
2. Separates entries by credential type (source account vs address)
3. Signs entries where a matching signer is found
4. Skips contract addresses (cannot be signed by accounts)
5. Optionally removes unsigned entries if `removeUnsigned` is true

## Errors

| Code      | Description                           |
| --------- | ------------------------------------- |
| `SAE_001` | Missing required argument             |
| `SAE_002` | Could not get current ledger from RPC |
| `SAE_003` | Failed to sign authorization entry    |
