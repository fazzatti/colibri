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

### Check Availability

```typescript
const network = NetworkConfig.MainNet();

if (network.friendbotUrl) {
  await initializeWithFriendbot(network.friendbotUrl, publicKey);
} else {
  console.log("No friendbot on this network - fund manually");
}
```

## Rate Limiting

Friendbot may rate limit requests. Handle this gracefully:

```typescript
async function fundWithRetry(
  friendbotUrl: string,
  publicKey: Ed25519PublicKey,
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await initializeWithFriendbot(friendbotUrl, publicKey);
      return; // Success!
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // Wait before retry
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

## Already Funded Accounts

Calling Friendbot on an already-funded account may fail or be a no-op depending on the implementation. It's safe to check first:

```typescript
import { initializeWithFriendbot, NetworkConfig } from "@colibri/core";
import { Server } from "stellar-sdk/rpc";

async function ensureFunded(
  publicKey: Ed25519PublicKey,
  network: NetworkConfig
) {
  const rpc = new Server(network.rpcUrl!);

  // Check if account exists
  try {
    await rpc.getAccount(publicKey);
    console.log("Account already funded");
    return;
  } catch {
    // Account doesn't exist - fund it
    if (network.friendbotUrl) {
      await initializeWithFriendbot(network.friendbotUrl, publicKey);
      console.log("Account funded!");
    }
  }
}
```

## Next Steps

- [Account](account.md) — Load funded accounts
- [Signer](signer.md) — Generate keypairs
- [Network](network.md) — Access Friendbot URLs
