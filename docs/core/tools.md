# Tools

The Tools module provides utility functions for common Stellar development tasks.

## Friendbot Initialization

### `initializeWithFriendbot`

Fund a new account on TestNet or FutureNet using Friendbot:

```typescript
import { initializeWithFriendbot, NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();

await initializeWithFriendbot(
  network.friendbotUrl,
  "GABC...XYZ" // Public key to fund
);

console.log("Account funded with 10,000 XLM!");
```

#### Signature

````typescript
async function initializeWithFriendbot(
  friendbotUrl: string,
  publicKey: Ed25519PublicKey
): Promise<void>;\n```\n\n## Usage Pattern

Common pattern for creating and funding a new test account:

```typescript
import {
  LocalSigner,
  NetworkConfig,
  initializeWithFriendbot,
  NativeAccount,
} from "@colibri/core";

async function createTestAccount() {
  // 1. Generate new keypair
  const signer = LocalSigner.generateRandom();
  console.log("Public Key:", signer.publicKey());

  // 2. Fund with Friendbot
  const network = NetworkConfig.TestNet();
  await initializeWithFriendbot(network.friendbotUrl, signer.publicKey());

  // 3. Create account instance
  const account = NativeAccount.fromMasterSigner(signer);
  console.log("Account created:", account.address());

  return signer;
}
````

## Network Availability

Friendbot is only available on test networks:

| Network   | Friendbot Available | URL                                       |
| --------- | ------------------- | ----------------------------------------- |
| MainNet   | —                   | —                                         |
| TestNet   | Yes                 | `https://friendbot.stellar.org`           |
| FutureNet | Yes                 | `https://friendbot-futurenet.stellar.org` |
| Custom    | Configurable        | Your own friendbot URL                    |

### Check Availability

```typescript
const network = NetworkConfig.MainNet();

if (network.friendbotUrl) {
  await initializeWithFriendbot(network.friendbotUrl, publicKey);
} else {
  console.log("No friendbot on this network - fund manually");
}
```

## Next Steps

- [Account](account.md) — Load funded accounts
- [Signer](signer.md) — Generate keypairs
- [Network](network.md) — Access Friendbot URLs
