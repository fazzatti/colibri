# StrKeys

The StrKeys module provides utilities for validating and identifying Stellar key types.

## Overview

Stellar uses different key prefixes for different entity types:

| Prefix | Type               | Example      |
| ------ | ------------------ | ------------ |
| `G`    | Ed25519 Public Key | `GABC...XYZ` |
| `S`    | Ed25519 Secret Key | `SABC...XYZ` |
| `C`    | Contract ID        | `CABC...XYZ` |
| `M`    | Muxed Account      | `MABC...XYZ` |

## Validation Functions

### `StrKey.isEd25519PublicKey`

Check if a string is a valid Stellar public key:

```typescript
import { StrKey } from "@colibri/core";

const input = "GABC...";

if (StrKey.isEd25519PublicKey(input)) {
  // input is now typed as Ed25519PublicKey
  console.log("Valid public key!");
}
```

### `StrKey.isEd25519SecretKey`

Check if a string is a valid Stellar secret key:

```typescript
if (StrKey.isEd25519SecretKey(input)) {
  // input is now typed as Ed25519SecretKey
  const signer = LocalSigner.fromSecret(input);
}
```

### `StrKey.isContractId`

Check if a string is a valid contract ID:

```typescript
if (StrKey.isContractId(input)) {
  // input is now typed as ContractId
  await invokeContract(input);
}
```

### `StrKey.isMuxedAddress`

Check if a string is a valid muxed account address:

```typescript
if (StrKey.isMuxedAddress(input)) {
  // input is now typed as MuxedAddress
  console.log("This is a muxed address");
}
```

## Type Guards

All validation functions are TypeScript type guards:

```typescript
function processAddress(address: string) {
  if (StrKey.isEd25519PublicKey(address)) {
    // TypeScript knows: address is Ed25519PublicKey
    loadAccount(address); // ✅ Type-safe
  } else if (StrKey.isContractId(address)) {
    // TypeScript knows: address is ContractId
    invokeContract(address); // ✅ Type-safe
  } else {
    throw new Error("Unknown address type");
  }
}
```

## Branded Types

Colibri uses branded string types for type safety:

```typescript
type Ed25519PublicKey = string & { __brand: "Ed25519PublicKey" };
type Ed25519SecretKey = string & { __brand: "Ed25519SecretKey" };
type ContractId = string & { __brand: "ContractId" };
type MuxedAddress = string & { __brand: "MuxedAddress" };
```

This prevents accidentally mixing up different key types:

```typescript
// Without branded types:
invokeContract(publicKey); // Would compile but fail at runtime

// With branded types:
invokeContract(publicKey); // ❌ Compile error - types don't match
```

## Address Validation Pattern

Common pattern for accepting any Stellar address:

```typescript
import { StrKey } from "@colibri/core";

type StellarAddress = Ed25519PublicKey | ContractId | MuxedAddress;

function validateAddress(input: string): StellarAddress {
  if (StrKey.isEd25519PublicKey(input)) {
    return input;
  }
  if (StrKey.isContractId(input)) {
    return input;
  }
  if (StrKey.isMuxedAddress(input)) {
    return input;
  }
  throw new Error(`Invalid address: ${input}`);
}
```

## Muxed Accounts (CAP-27)

Muxed accounts embed a 64-bit ID within a public key:

```typescript
// Regular account
const publicKey = "GABC...XYZ";

// Same account with muxed ID
const muxedAccount = "MABC..."; // Encodes publicKey + ID

if (StrKey.isMuxedAddress(muxedAccount)) {
  // Can extract the base public key and ID
  // using stellar-sdk utilities
}
```

See [SAC Events](../events/standardized-events/sac.md) for how muxed accounts appear in events (CAP-67).

## Usage Examples

### Input Validation

```typescript
import { StrKey } from "@colibri/core";

function transfer(from: string, to: string, amount: bigint) {
  // Validate inputs before processing
  if (!StrKey.isEd25519PublicKey(from)) {
    throw new Error("Invalid 'from' address");
  }

  if (!StrKey.isEd25519PublicKey(to) && !StrKey.isMuxedAddress(to)) {
    throw new Error("Invalid 'to' address");
  }

  // Proceed with validated addresses
}
```

### API Response Handling

```typescript
import { Server } from "stellar-sdk/rpc";

// When receiving addresses from external sources
const response = await fetch("/api/address");
const data = await response.json();

if (StrKey.isEd25519PublicKey(data.address)) {
  // Safe to use as a public key
  const rpc = new Server("https://soroban-testnet.stellar.org");
  const account = await rpc.getAccount(data.address);
}
```

## Next Steps

- [Account](account.md) — Load accounts using validated public keys
- [Contract](contract.md) — Work with validated contract IDs
- [Signer](signer.md) — Create signers from secret keys
