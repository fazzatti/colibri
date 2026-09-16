# useContract

Retain a full Core Contract or generated subclass across ordinary rerenders.

Import from `@colibri/react/contracts`. Call inside a React component. This hook
does not require a Colibri or Query provider.

## Parameters and result

- `factory`: synchronous function constructing the client.
- `dependencies`: React dependency list describing its network, address, spec
  and other construction inputs.

**Returns:** The inferred client instance, retaining its pipelines, plugins and
full API.

## Example

<!-- deno-check @colibri/react -->

```tsx
import {
  Contract,
  type ContractId,
  type NetworkConfig,
} from "@colibri/core/contract";
import { useContract } from "@colibri/react/contracts";

export function ContractAddress({ network, contractId }: {
  network: NetworkConfig;
  contractId: ContractId;
}) {
  const contract = useContract(() =>
    new Contract({
      networkConfig: network,
      contractConfig: { contractId },
    }), [network, contractId]);
  return <p>{contract.getContractId()}</p>;
}
```

## Behavior

The factory is React `useMemo` work: keep it free of requests, prompts and
subscriptions. React may repeat construction or discard a memo. For a lifetime
owned independently of React, construct the client outside rendering and pass it
to the read/invoke hooks. Replace `Contract` with your generated subclass to
retain its helper types.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/contracts/~/useContract)
