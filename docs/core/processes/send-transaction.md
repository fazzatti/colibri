# SendTransaction

Submits a signed transaction to the network and waits for confirmation.

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

The process:

1. Submits the transaction to RPC
2. Polls for transaction status until confirmed or timeout
3. Returns the result on success
4. Throws typed errors for failures (duplicate, try again, error status)

## Errors

| Code      | Description                     |
| --------- | ------------------------------- |
| `STX_001` | Missing required argument       |
| `STX_002` | Timeout too low (< 1 second)    |
| `STX_003` | Wait interval too low (< 100ms) |
| `STX_004` | Failed to send transaction      |
| `STX_005` | Duplicate transaction           |
| `STX_006` | Try again later                 |
| `STX_007` | Transaction error status        |
| `STX_008` | Transaction not found (timeout) |
| `STX_009` | Transaction failed              |
