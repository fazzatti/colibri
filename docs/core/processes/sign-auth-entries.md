# SignAuthEntries

Signs Soroban authorization entries for contract calls that require authorization from specific accounts. When a contract calls `require_auth()`, the authorization entry must be signed by the required account before the transaction can succeed.

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

1. **Fetches current ledger** — Calls RPC to get the latest ledger sequence
2. **Calculates validity** — Determines the `validUntilLedgerSeq` based on the validity option:
   - Default: 120 ledgers (~10 minutes)
   - `validForSeconds`: Converts to ledgers (5 seconds per ledger)
   - `validForLedgers`: Uses the specified number
   - `validUntilLedgerSeq`: Uses the exact value
3. **Separates credential types**:
   - **Source account credentials** — Passed through (no signature needed in auth entry)
   - **Address credentials** — Need to be signed
   - **Already signed entries** — Preserved as-is (detected by checking for empty signature)
4. **Filters by address type**:
   - **Account addresses** — Signs with matching signer
   - **Contract addresses** — Cannot be signed by accounts, skipped
   - **Claimable balance addresses** — Skipped
   - **Liquidity pool addresses** — Skipped
   - **Muxed account addresses** — Skipped
5. **Signs matching entries** — For each account address entry, finds the signer with matching public key and signs
6. **Handles `removeUnsigned`** — If `true`, entries without a matching signer are removed from output; if `false` (default), they're included unsigned

### Validity Validation

- `validUntilLedgerSeq` must be > 0
- `validForSeconds` must be > 5
- `validForLedgers` must be > 0

## Errors

| Code      | Description                                 |
| --------- | ------------------------------------------- |
| `SAE_001` | Missing required argument                   |
| `SAE_002` | Could not get current ledger from RPC       |
| `SAE_003` | Failed to sign authorization entry          |
| `SAE_004` | Missing signer for required address         |
| `SAE_005` | Valid until ledger sequence too low (≤ 0)   |
| `SAE_006` | Valid for seconds too low (≤ 5)             |
| `SAE_007` | Valid for ledgers too low (≤ 0)             |
