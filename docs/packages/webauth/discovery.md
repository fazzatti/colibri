# Discovery and routing

[WebAuth overview](../webauth.md)

## Create a client

```typescript
import { NetworkConfig } from "@colibri/core";
import { WebAuthClient } from "@colibri/webauth";

const client = await WebAuthClient.fromDomain("anchor.example.com", {
  network: NetworkConfig.TestNet(),
});
```

The network supplied by the application is authoritative. If stellar.toml or a
challenge response includes a different network passphrase, authentication
fails.

`fromDomain()` fetches the home domain's `stellar.toml` before a challenge is
requested. `fromToml(toml, options)` accepts an already parsed Core
`StellarToml`. Direct construction uses
`new WebAuthClient({ homeDomain, signingKey, network,
sep10?, sep45? })`, where
SEP-10 supplies `{ endpoint }` and SEP-45 supplies `{ endpoint, contractId }`.
Direct configuration means the application is responsible for the
trustworthiness of that discovery data.

Construction accepts `timeout` (30,000 ms by default), `fetch`,
`submissionFormat` (`json` by default or `form`), and `allowHttp` for deliberate
local development. The timeout bounds HTTP requests, not the server challenge's
validity period. The challenge's own time/ledger constraints remain
authoritative.

## Choose a path

`WebAuthClient` exposes three entry points:

- `client.authenticate(...)` routes by account type.
- `client.sep10` selects SEP-10 explicitly.
- `client.sep45` selects SEP-45 explicitly.

Automatic routing is deterministic and has no protocol fallback:

| Account | Protocol | Required option | Invalid options                         |
| ------- | -------- | --------------- | --------------------------------------- |
| `G...`  | SEP-10   | `signer`        | SEP-45 authorization options            |
| `M...`  | SEP-10   | `signer`        | `memo` and SEP-45 authorization options |
| `C...`  | SEP-45   | `authorize`     | `signer` and `memo`                     |

Inspect discovery and routing with:

```typescript
client.supports("sep10");
client.supports("sep45");
client.protocolFor(account);
```

## Client domains

Pass the client domain and its signing key:

```typescript
const jwt = await client.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
  clientDomain: "wallet.example.com",
  clientDomainSigner: walletDomainKeypair,
});
```

The client domain's stellar.toml is fetched only when the server's challenge
actually accepts the requested client domain.
