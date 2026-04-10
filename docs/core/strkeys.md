# StrKeys

The StrKeys module provides TypeScript type guards for validating Stellar key formats as defined in [SEP-23](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md).

## Type Guards

Use `StrKey` to validate and narrow string types:

```typescript
import { StrKey } from "@colibri/core";

const input = "GABC...";

if (StrKey.isEd25519PublicKey(input)) {
  // TypeScript knows input is Ed25519PublicKey
  await loadAccount(input);
}

if (StrKey.isContractId(input)) {
  // TypeScript knows input is ContractId
  await invokeContract(input);
}

if (StrKey.isMuxedAddress(input)) {
  // TypeScript knows input is MuxedAddress
}

if (StrKey.isEd25519SecretKey(input)) {
  // TypeScript knows input is Ed25519SecretKey
  const signer = LocalSigner.fromSecret(input);
}
```

## Example Usage

```typescript
import { StrKey } from "@colibri/core";

function processAddress(address: string) {
  if (StrKey.isEd25519PublicKey(address)) {
    return loadAccount(address);
  }
  if (StrKey.isContractId(address)) {
    return invokeContract(address);
  }
  throw new Error(`Invalid address: ${address}`);
}
```

## Next Steps

- [Account](account.md) — Load accounts using validated public keys
- [Contract](contract.md) — Work with validated contract IDs
- [Signer](signer/README.md) — Create signers from secret keys
