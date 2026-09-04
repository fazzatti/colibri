# ParseClassicTransactionOutcome

Extracts successful classic operation results from a confirmed Stellar RPC
response. The process is also the final step of the classic transaction
pipeline.

## `parseClassicTransactionOutcome`

```ts
import { parseClassicTransactionOutcome } from "@colibri/core";

const outcome = parseClassicTransactionOutcome(sendTransactionOutput);

console.log(outcome.feeCharged);
console.log(outcome.operations);
```

## Input

The input is a successful `SendTransactionOutput`, including the parsed
`response.resultXdr` returned by Stellar RPC.

## Output

The process preserves all submission fields and adds:

```ts
type ParseClassicTransactionOutcomeOutput = SendTransactionOutput & {
  feeCharged: bigint;
  operations: ClassicOperationOutcome[];
};
```

Each outcome contains its zero-based operation `index`, its Stellar operation
result `type`, and the corresponding successful Stellar SDK XDR `result`.
Narrowing `type` narrows `result`:

```ts
const operation = outcome.operations[0];

if (operation.type === "accountMerge") {
  console.log(operation.result.sourceAccountBalance);
}
```

The process handles direct transactions and unwraps the inner successful result
of fee-bump transactions. It rejects inconsistent inputs—such as an RPC success
response carrying a failed transaction or operation arm—with errors from the
`PCTO_ERRORS` namespace.

## Errors

See
[every code for this context](../../reference/errors/core-processes-parse-classic-transaction-outcome.md)
and the [error-handling guide](../../core/error.md).
