# useWalletContractInvoke

Invoke a generated method with wallet-derived transaction authority, preserving
explicit configuration overrides and the client's existing pipeline.

Import from `@colibri/react/contracts/invoke`. Use under `ColibriQueryProvider`
or both granular providers; see [setup](../setup.md).

## Parameters and result

- `contract`: an existing generated client; load it before mounting the
  component.
- `method`: the generated camelCase helper property.
- `options?`: mutation callbacks and controls.
- Call `mutate` or `mutateAsync` with the generated invocation arguments. Its
  `config` is optional and accepts partial `TransactionConfig` overrides.

**Returns:** A mutation result with inferred invocation arguments and output,
including the generated decoded value and transaction metadata.

## Example

The parent supplies a generated Counter client with an `increment` helper. The
prop type describes only the surface this component needs. Configure a wallet
with the required signing capabilities using
[common workflows](../convenience.md).

<!-- deno-check @colibri/react -->

```tsx
import {
  type ContractIdentity,
  type TransactionConfig,
  useWalletContractInvoke,
} from "@colibri/react/contracts/invoke";
import { useWallet } from "@colibri/react/wallet";

type CounterClient = ContractIdentity & {
  increment: {
    invoke(
      input: { methodArgs: { by: number }; config: TransactionConfig },
    ): Promise<unknown>;
  };
};

export function Increment({ contract }: { contract: CounterClient }) {
  const wallet = useWallet();
  const increment = useWalletContractInvoke(contract, "increment");
  return (
    <section>
      <button
        disabled={wallet.status !== "connected" || increment.isPending}
        onClick={() => increment.mutate({ methodArgs: { by: 1 } })}
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

Only an explicit mutation call can request signing. Missing `config.source` and
`config.signers` come from the connected wallet. Each override is independent:
explicit signers are never appended to. If both fields are supplied, no wallet
connection is required. A C-address wallet needs an explicit G-account
transaction source; the application supplies capabilities suitable for its
account policy.

The contract and provider networks must match. Wallet-derived capabilities are
guarded against connection changes. The original client retains its plugins,
error matcher, fee defaults and timeout defaults. Mutations serialize within the
provider scope and never retry automatically. Invalidate affected reads after
success and reconcile ambiguous submission outcomes before trying again.

## See also

- [useContractInvoke](use-contract-invoke.md) for fully explicit configuration
- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/contracts/invoke/~/useWalletContractInvoke)
