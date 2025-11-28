# SendTransaction

Submits a signed transaction to the network and waits for confirmation. This process handles the full lifecycle of transaction submission, including polling for the final status.

## `P_SendTransaction`

```typescript
import { P_SendTransaction } from "@colibri/core";

const result = await P_SendTransaction().run({
  transaction: signedTx,
  rpc: rpcServer,
});

console.log(result.hash);
console.log(result.returnValue);
```

## Input

| Property      | Type                                | Required | Description                 |
| ------------- | ----------------------------------- | -------- | --------------------------- |
| `transaction` | `Transaction \| FeeBumpTransaction` | Yes      | Signed transaction          |
| `rpc`         | `Server`                            | Yes      | Soroban RPC server          |
| `options`     | `SendTransactionOptions`            | —        | Timeout and polling options |

### Options

| Option                             | Default | Description                       |
| ---------------------------------- | ------- | --------------------------------- |
| `timeoutInSeconds`                 | `45`    | Max time to wait for confirmation |
| `waitIntervalInMs`                 | `500`   | Polling interval                  |
| `useTransactionTimeoutIfAvailable` | `true`  | Use transaction's timeout if set  |

## Output

```typescript
type SendTransactionOutput = {
  hash: string;
  returnValue: xdr.ScVal | undefined;
  response: Api.GetSuccessfulTransactionResponse;
};
```

- `hash` — Transaction hash
- `returnValue` — Contract return value (for Soroban transactions)
- `response` — Full response from RPC

## Behavior

### Validation

1. **Validates timeout** — Must be ≥ 1 second
2. **Validates polling interval** — Must be ≥ 100 milliseconds

### Submission Flow

1. **Sends transaction** — Calls `rpc.sendTransaction()`
2. **Checks initial status**:
   - `PENDING` — Proceeds to polling
   - `DUPLICATE` — Transaction already submitted, throws error
   - `TRY_AGAIN_LATER` — Network busy, throws error
   - `ERROR` — Transaction invalid, throws with error details and diagnostic events
3. **Calculates wait time** — If `useTransactionTimeoutIfAvailable` is true and the transaction has a timeout, uses that; otherwise uses `timeoutInSeconds`
4. **Polls for status** — Recursively calls `rpc.getTransaction()` until:
   - Transaction reaches a final status (`SUCCESS` or `FAILED`)
   - Timeout is reached
5. **Returns result** — On success, returns hash, return value, and full response

### Timeout Behavior

The process will poll until one of these conditions:

- Transaction status becomes `SUCCESS` or `FAILED`
- The calculated wait time is exceeded
- If timeout is exceeded while status is still `NOT_FOUND`, throws `TRANSACTION_NOT_FOUND`

## Errors

| Code      | Description                                     |
| --------- | ----------------------------------------------- |
| `STX_001` | Missing required argument                       |
| `STX_002` | Timeout too low (< 1 second)                    |
| `STX_003` | Wait interval too low (< 100ms)                 |
| `STX_004` | Failed to send transaction (network error)      |
| `STX_005` | Duplicate transaction (already submitted)       |
| `STX_006` | Try again later (network congestion)            |
| `STX_007` | Transaction error status (invalid transaction)  |
| `STX_008` | Transaction not found after timeout             |
| `STX_009` | Transaction failed (execution error)            |
| `STX_010` | Failed to get transaction status during polling |
| `STX_011` | Unexpected transaction status                   |
