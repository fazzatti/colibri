# useContractInvoke

Invoke a generated method using the client’s existing invocation pipeline.

Import from `@colibri/react/contracts/invoke`. Use under both `ColibriProvider`
and `QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `contract`: an existing generated client.
- `method`: the generated camelCase helper property.
- `options?`: mutation callbacks and controls. Call `mutate` or `mutateAsync`
  with the helper’s single invocation object.

**Returns:** A mutation result with inferred invocation arguments and output,
including the generated decoded `value` and Core transaction metadata.

## Example

Pass a generated client whose `increment` helper accepts
`{ methodArgs: { by }, config }`, plus your prepared Core transaction
configuration. The prop type narrows the example’s required surface; your
generated client retains its more specific result type.

<!-- deno-check @colibri/react -->

```tsx
import {
  type ContractIdentity,
  type TransactionConfig,
  useContractInvoke,
} from "@colibri/react/contracts/invoke";

type CounterClient = ContractIdentity & {
  increment: {
    invoke(
      input: { methodArgs: { by: number }; config: TransactionConfig },
    ): Promise<unknown>;
  };
};

export function Increment(
  { contract, config }: { contract: CounterClient; config: TransactionConfig },
) {
  const increment = useContractInvoke(contract, "increment");
  return (
    <section>
      <button
        disabled={increment.isPending}
        onClick={() =>
          increment.mutate({
            methodArgs: { by: 1 },
            config,
          })}
      >
        Increment
      </button>
      {increment.isError && <p role="alert">{increment.error.message}</p>}
      {increment.isSuccess && <p>Invocation completed.</p>}
    </section>
  );
}
```

## Behavior

The contract/provider networks must match. Signers and authorization inputs stay
explicit; the hook does not borrow wallet signers automatically. Existing
plugins are retained. Automatic retries are disabled; reconcile ambiguous
submission outcomes before another invocation. Invalidate affected reads
explicitly after success; see [queries and caching](../queries.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/contracts/invoke/~/useContractInvoke)
