# Account

The Account module provides the `NativeAccount` class for working with Stellar accounts.

## NativeAccount

Create an account instance from an address:

```typescript
import { NativeAccount } from "@colibri/core";

const account = NativeAccount.fromAddress("GABC...XYZ");
```

### Methods

#### address()

Get the account's public key:

```typescript
account.address(); // "GABC...XYZ"
```

#### muxedAddress(id)

Generate a muxed address (M...) for this account:

```typescript
const muxed = account.muxedAddress("12345");
```

#### withMasterSigner(signer)

Attach a signer to the account:

```typescript
import { LocalSigner } from "@colibri/core";

const signer = LocalSigner.fromSecret("S...");
const signableAccount = account.withMasterSigner(signer);
```

#### signer()

Get the attached signer (throws if none attached):

```typescript
const signer = signableAccount.signer();
```

### Static Methods

#### fromMasterSigner(signer)

Create an account directly from a signer:

```typescript
import { LocalSigner, NativeAccount } from "@colibri/core";

const signer = LocalSigner.fromSecret("S...");
const account = NativeAccount.fromMasterSigner(signer);
```

## Errors

| Code          | Description                     |
| ------------- | ------------------------------- |
| `ACC_NAT_001` | Invalid Ed25519 public key      |
| `ACC_NAT_002` | Invalid muxed ID                |
| `ACC_NAT_003` | Invalid muxed address generated |
| `ACC_NAT_004` | Missing master signer           |
| `ACC_NAT_005` | Unsupported address type        |
