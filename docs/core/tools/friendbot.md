# Friendbot

Fund accounts on [TestNet or FutureNet](../network.md#built-in-configurations)
using Friendbot.

## `initializeWithFriendbot`

```typescript
import { initializeWithFriendbot, NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();

await initializeWithFriendbot(
  network.friendbotUrl,
  "GABC...XYZ",
  {
    rpcUrl: network.rpcUrl,
  },
);
```

### Signature

```typescript
async function initializeWithFriendbot(
  friendbotUrl: string,
  publicKey: Ed25519PublicKey,
  options?: {
    rpcUrl?: string;
    allowHttp?: boolean;
    timeoutInMs?: number;
    pollIntervalInMs?: number;
  },
): Promise<void>;
```

## Example

Create a [LocalSigner](../signer/local-signer.md), fund its address, then bind a
[NativeAccount](../account.md) to that signer:

```typescript
import {
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
} from "@colibri/core";

const signer = LocalSigner.generateRandom();
const network = NetworkConfig.TestNet();

await initializeWithFriendbot(network.friendbotUrl, signer.publicKey(), {
  rpcUrl: network.rpcUrl,
});

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
  await initializeWithFriendbot(network.friendbotUrl, publicKey, {
    rpcUrl: network.rpcUrl,
  });
}
```

## Next Steps

- [Account](../account.md) — Load funded accounts
- [Signer](../signer/README.md) — Generate keypairs
- [Network](../network.md) — Access Friendbot URLs
