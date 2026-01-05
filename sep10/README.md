# @colibri/sep10

SEP-10 Web Authentication client for Stellar. Part of the [Colibri](https://github.com/fazzatti/colibri) ecosystem.

[📚 Documentation](https://colibri-docs.gitbook.io/) | [💡 Examples](https://github.com/fazzatti/colibri-examples)

## Installation

```sh
# Deno (JSR)
deno add jsr:@colibri/sep10

# Node.js / npm
npm install @colibri/sep10
```

## Features

- **Full authentication flow** – Complete SEP-10 flow with a single `authenticate()` call
- **Step-by-step control** – Or use `getChallenge()` and `submitChallenge()` for granular control
- **Challenge validation** – Verify server signatures, time bounds, home domain, and web auth domain
- **JWT parsing** – Decode and inspect JWT tokens with `Sep10Jwt` helper
- **Flexible signing** – Sign with Keypair, Signer interface, or custom functions
- **Memo & muxed accounts** – Full support for shared accounts and M... addresses
- **Configurable timeout** – Built-in request timeout with AbortController

## Quick start

```ts
import { Sep10Client } from "@colibri/sep10";
import { StellarToml } from "@colibri/core";
import { Keypair, Networks } from "stellar-sdk";

// Fetch anchor's stellar.toml
const toml = await StellarToml.fromDomain("anchor.example.com");

// Create client from TOML
const client = Sep10Client.fromToml(
  { WEB_AUTH_ENDPOINT: toml.webAuthEndpoint, SIGNING_KEY: toml.signingKey },
  "anchor.example.com",
  Networks.PUBLIC
);

// Authenticate with a single call
const keypair = Keypair.fromSecret("S...");
const jwt = await client.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
});

// Use the JWT for authenticated requests
console.log("Token:", jwt.token);
console.log("Expires:", jwt.expiresAt);
console.log("Is expired:", jwt.isExpired);
```

## Authentication methods

### Full flow (`authenticate`)

Completes the entire SEP-10 flow in one call: fetches challenge, signs it, and submits for a JWT.

```ts
const jwt = await client.authenticate({
  account: "G...",
  signer: keypair, // Keypair, Signer, or signer function
});

// With memo for shared accounts
const jwt = await client.authenticate({
  account: "G...",
  signer: keypair,
  memo: "12345",
});

// With multiple signers
const jwt = await client.authenticate({
  account: "G...",
  signer: [keypair1, keypair2],
});
```

### Step-by-step flow

For more control, use the individual methods:

```ts
// Step 1: Get challenge from server
const challenge = await client.getChallenge({
  account: "G...",
  memo: "12345", // optional
  clientDomain: "wallet.example.com", // optional
});

// Step 2: Verify the challenge (optional - getChallenge does this automatically)
challenge.verify(serverPublicKey, {
  homeDomain: "anchor.example.com",
  webAuthDomain: "auth.anchor.example.com",
});

// Step 3: Sign the challenge
challenge.sign(keypair);

// Step 4: Submit for JWT
const jwt = await client.submitChallenge(challenge);
```

## Client configuration

### Constructor options

```ts
const client = new Sep10Client({
  authEndpoint: "https://anchor.example.com/auth",
  serverPublicKey: "G...",
  homeDomain: "anchor.example.com",
  networkPassphrase: Networks.PUBLIC,
  webAuthDomain: "auth.anchor.example.com", // optional
  timeout: 30000, // optional: request timeout in ms (default: 30000)
  fetch: customFetch, // optional: custom fetch implementation
});
```

### Create from stellar.toml

```ts
const client = Sep10Client.fromToml(
  {
    WEB_AUTH_ENDPOINT: "https://anchor.example.com/auth",
    SIGNING_KEY: "G...",
  },
  "anchor.example.com",
  Networks.PUBLIC
);
```

## SEP10Challenge class

Parse and manipulate SEP-10 challenge transactions directly:

```ts
import { SEP10Challenge } from "@colibri/sep10";

// Parse from XDR
const challenge = SEP10Challenge.fromXDR(xdrString, Networks.PUBLIC);

// Inspect challenge properties
console.log("Client account:", challenge.clientAccount);
console.log("Home domain:", challenge.homeDomain);
console.log("Web auth domain:", challenge.webAuthDomain);
console.log("Is expired:", challenge.isExpired);
console.log("Time bounds:", challenge.timeBounds);

// Verify challenge
challenge.verify(serverPublicKey, {
  homeDomain: "anchor.example.com",
  allowExpired: false,
});

// Sign and export
challenge.sign(keypair);
const signedXdr = challenge.toXDR();
```

### Building challenges (server-side)

```ts
const challenge = SEP10Challenge.build({
  serverAccount: "G...",
  clientAccount: "G...",
  homeDomain: "anchor.example.com",
  networkPassphrase: Networks.PUBLIC,
  webAuthDomain: "auth.anchor.example.com",
  timeout: 900, // 15 minutes
});

// Sign with server key
challenge.sign(serverKeypair);

// Send to client
const xdr = challenge.toXDR();
```

## Sep10Jwt class

Decode and inspect JWT tokens:

```ts
import { Sep10Jwt } from "@colibri/sep10";

// Parse from token string
const jwt = Sep10Jwt.fromToken(tokenString);

// Standard JWT claims
console.log("Subject:", jwt.subject); // G... or G...:memo
console.log("Issuer:", jwt.issuer);
console.log("Expires at:", jwt.expiresAt);
console.log("Issued at:", jwt.issuedAt);
console.log("JWT ID:", jwt.jti);

// SEP-10 specific claims
console.log("Home domain:", jwt.homeDomain);
console.log("Web auth domain:", jwt.webAuthDomain);
console.log("Client domain:", jwt.clientDomain);
console.log("Memo:", jwt.memo);
console.log("Muxed account ID:", jwt.muxedAccountId);

// Expiration helpers
console.log("Is expired:", jwt.isExpired);
console.log("Time until expiration:", jwt.timeUntilExpiration);

// Get all claims
const claims = jwt.claims;

// Use in Authorization header
const authHeader = `Bearer ${jwt.token}`;
```

## Error handling

All errors extend `ColibriError` from `@colibri/core`:

```ts
import { ChallengeErrors, ClientErrors } from "@colibri/sep10";

try {
  const jwt = await client.authenticate({ account, signer });
} catch (err) {
  if (err instanceof ClientErrors.FETCH_CHALLENGE_FAILED) {
    console.log("Network error:", err.meta.data);
  } else if (err instanceof ClientErrors.TIMEOUT) {
    console.log("Request timed out");
  } else if (err instanceof ChallengeErrors.INVALID_SERVER_SIGNATURE) {
    console.log("Challenge signature invalid");
  } else if (err instanceof ChallengeErrors.CHALLENGE_EXPIRED) {
    console.log("Challenge has expired");
  }
}
```

### Challenge errors (SEP10_CHAL_XXX)

| Code           | Error                      | Description                                      |
| -------------- | -------------------------- | ------------------------------------------------ |
| SEP10_CHAL_001 | `INVALID_XDR`              | Invalid base64/XDR encoding                      |
| SEP10_CHAL_002 | `INVALID_SEQUENCE`         | Sequence number must be 0                        |
| SEP10_CHAL_003 | `MISSING_TIME_BOUNDS`      | Transaction has no time bounds                   |
| SEP10_CHAL_004 | `CHALLENGE_EXPIRED`        | Challenge is expired or not yet valid            |
| SEP10_CHAL_005 | `NO_OPERATIONS`            | Transaction has no operations                    |
| SEP10_CHAL_006 | `INVALID_FIRST_OPERATION`  | First operation must be ManageData               |
| SEP10_CHAL_007 | `CLIENT_ACCOUNT_MISMATCH`  | First operation source doesn't match client      |
| SEP10_CHAL_008 | `INVALID_HOME_DOMAIN`      | Invalid home domain format or mismatch           |
| SEP10_CHAL_009 | `INVALID_NONCE`            | Nonce must be 64 bytes (48 bytes base64 encoded) |
| SEP10_CHAL_010 | `INVALID_SERVER_SIGNATURE` | Server signature is invalid or missing           |
| SEP10_CHAL_011 | `INVALID_WEB_AUTH_DOMAIN`  | Web auth domain mismatch                         |
| SEP10_CHAL_012 | `INVALID_CLIENT_DOMAIN`    | Client domain operation is invalid               |
| SEP10_CHAL_013 | `INVALID_OPERATION_SOURCE` | Operation source must be server or client        |
| SEP10_CHAL_014 | `INVALID_MEMO_TYPE`        | Memo must be of type ID                          |
| SEP10_CHAL_015 | `MUXED_ACCOUNT_WITH_MEMO`  | Cannot use memo with muxed account               |
| SEP10_CHAL_016 | `MISSING_SIGNATURE`        | Required signature is missing                    |

### Client errors (SEP10_CLI_XXX)

| Code          | Error                     | Description                               |
| ------------- | ------------------------- | ----------------------------------------- |
| SEP10_CLI_001 | `FETCH_CHALLENGE_FAILED`  | Failed to fetch challenge from server     |
| SEP10_CLI_002 | `SUBMIT_CHALLENGE_FAILED` | Failed to submit signed challenge         |
| SEP10_CLI_003 | `TIMEOUT`                 | Request timed out                         |
| SEP10_CLI_004 | `INVALID_SERVER_RESPONSE` | Server returned invalid JSON              |
| SEP10_CLI_005 | `MISSING_JWT`             | Server response missing token field       |
| SEP10_CLI_006 | `INVALID_JWT`             | JWT token is malformed                    |
| SEP10_CLI_007 | `MISSING_AUTH_ENDPOINT`   | TOML missing WEB_AUTH_ENDPOINT            |
| SEP10_CLI_008 | `INVALID_TOML`            | TOML missing required field (SIGNING_KEY) |

## Example: Complete authentication

```ts
import { Sep10Client, Sep10Jwt } from "@colibri/sep10";
import { StellarToml } from "@colibri/core";
import { Keypair, Networks } from "stellar-sdk";

async function authenticateWithAnchor(
  domain: string,
  secretKey: string
): Promise<Sep10Jwt> {
  // Fetch the anchor's stellar.toml
  const toml = await StellarToml.fromDomain(domain);

  if (!toml.webAuthEndpoint || !toml.signingKey) {
    throw new Error("Anchor does not support SEP-10");
  }

  // Create client
  const client = Sep10Client.fromToml(
    { WEB_AUTH_ENDPOINT: toml.webAuthEndpoint, SIGNING_KEY: toml.signingKey },
    domain,
    Networks.PUBLIC
  );

  // Authenticate
  const keypair = Keypair.fromSecret(secretKey);
  return client.authenticate({
    account: keypair.publicKey(),
    signer: keypair,
  });
}

// Usage
const jwt = await authenticateWithAnchor("anchor.example.com", "S...");

// Use JWT for SEP-6, SEP-24, SEP-31, etc.
const response = await fetch("https://anchor.example.com/sep6/deposit", {
  headers: { Authorization: `Bearer ${jwt.token}` },
});
```

## Related packages

- [`@colibri/core`](../core) – Core utilities including `StellarToml`, `Signer`, and network configuration
- [`@colibri/event-streamer`](../event-streamer) – Real-time event streaming for Stellar/Soroban
