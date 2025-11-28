# Friendbot

Fund accounts on TestNet or FutureNet using Friendbot.

## `initializeWithFriendbot`

```typescript
import { initializeWithFriendbot, NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();

await initializeWithFriendbot(
  network.friendbotUrl,
  "GABC...XYZ" // Public key to fund
);
```

### Signature

```typescript
async function initializeWithFriendbot(
  friendbotUrl: string,
  publicKey: Ed25519PublicKey
): Promise<void>;
```

## Example

Creating and funding a new test account:

```typescript
import {
  LocalSigner,
  NetworkConfig,
  initializeWithFriendbot,
  NativeAccount,
} from "@colibri/core";

const signer = LocalSigner.generateRandom();
const network = NetworkConfig.TestNet();

await initializeWithFriendbot(network.friendbotUrl, signer.publicKey());

const account = NativeAccount.fromMasterSigner(signer);
```

## Network Availability

| Network   | Friendbot Available | URL                                       |
| --------- | ------------------- | ----------------------------------------- |
| MainNet   | —                   | —                                         |
| TestNet   | Yes                 | `https://friendbot.stellar.org`           |
| FutureNet | Yes                 | `https://friendbot-futurenet.stellar.org` |
| Custom    | Configurable        | Your own friendbot URL                    |

Check availability before calling:

```typescript
const network = NetworkConfig.MainNet();

if (network.friendbotUrl) {
  await initializeWithFriendbot(network.friendbotUrl, publicKey);
}
```

## Next Steps

- [Account](../account.md) — Load funded accounts
- [Signer](../signer/README.md) — Generate keypairs
- [Network](../network.md) — Access Friendbot URLs
