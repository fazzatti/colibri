# SEP-10

The `@colibri/sep10` package provides [SEP-10 Web Authentication](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) for Stellar.

## Installation

```bash
deno add jsr:@colibri/sep10
```

## Quick Start

```typescript
import { Sep10Client } from "@colibri/sep10";
import { StellarToml } from "@colibri/core";
import { Keypair } from "stellar-sdk";

// Fetch and parse stellar.toml
const toml = await StellarToml.fromDomain("anchor.example.com");

// Create client directly from StellarToml instance
const client = Sep10Client.fromToml(toml);

const keypair = Keypair.fromSecret("S...");
const jwt = await client.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
});

// Use jwt.token for authenticated requests
```

## Sep10Client

### Constructor

```typescript
const client = new Sep10Client({
  authEndpoint: string;
  serverPublicKey: string;
  homeDomain: string;
  networkPassphrase: string;
  webAuthDomain?: string;
  timeout?: number;        // Default: 30000ms
  fetch?: typeof fetch;
});
```

### `fromToml(toml, networkPassphrase?)`

Create client from a `StellarToml` instance:

```typescript
const toml = await StellarToml.fromDomain("anchor.example.com");
const client = Sep10Client.fromToml(toml);

// Or with network passphrase override
const client = Sep10Client.fromToml(toml, Networks.TESTNET);
```

The client extracts `webAuthEndpoint`, `signingKey`, `domain`, and `networkPassphrase` from the `StellarToml` instance.

**Throws:**

- `INVALID_TOML` if domain is missing
- `MISSING_AUTH_ENDPOINT` if `WEB_AUTH_ENDPOINT` is missing
- `INVALID_TOML` if `SIGNING_KEY` is missing
- `INVALID_TOML` if `WEB_AUTH_ENDPOINT` is not a valid URL
- `INVALID_TOML` if `NETWORK_PASSPHRASE` is missing and not provided

### `authenticate(options)`

Complete authentication flow in one call:

```typescript
const jwt = await client.authenticate({
  account: string;
  signer: Keypair | Signer | Keypair[] | Signer[];
  memo?: string;              // For shared accounts
  clientDomain?: string;      // For client domain verification
  extraSigners?: (Keypair | Signer)[];
});
```

### `getChallenge(options)`

Fetch and verify a challenge transaction:

```typescript
const challenge = await client.getChallenge({
  account: string;
  memo?: string;
  clientDomain?: string;
});
```

### `submitChallenge(challenge)`

Submit a signed challenge for a JWT:

```typescript
const jwt = await client.submitChallenge(challenge);
```

## SEP10Challenge

Parse and manipulate challenge transactions directly.

### `fromXDR(xdr, networkPassphrase)`

Parse a challenge from XDR:

```typescript
const challenge = SEP10Challenge.fromXDR(xdrString, Networks.PUBLIC);
```

### `build(options)`

Build a challenge transaction (server-side):

```typescript
const challenge = SEP10Challenge.build({
  serverAccount: string;
  clientAccount: string;
  homeDomain: string;
  networkPassphrase: string;
  webAuthDomain?: string;
  clientDomain?: string;
  clientDomainAccount?: string;
  memo?: string;
  timeout?: number;  // Default: 900 (15 minutes)
  nonce?: Buffer;
});
```

### Properties

| Property        | Type                       | Description                   |
| --------------- | -------------------------- | ----------------------------- |
| `clientAccount` | `string`                   | Client's Stellar account      |
| `serverAccount` | `string`                   | Server's Stellar account      |
| `homeDomain`    | `string`                   | Home domain from challenge    |
| `webAuthDomain` | `string?`                  | Web auth domain if present    |
| `clientDomain`  | `string?`                  | Client domain if present      |
| `memo`          | `string?`                  | Memo if present               |
| `timeBounds`    | `{ minTime, maxTime }`     | Challenge validity period     |
| `isExpired`     | `boolean`                  | Whether challenge has expired |
| `nonce`         | `Buffer`                   | 48-byte random nonce          |
| `signatures`    | `xdr.DecoratedSignature[]` | Current signatures            |

### Methods

```typescript
challenge.verify(serverPublicKey, options?);  // Verify challenge
challenge.sign(signer);                        // Sign with Keypair or Signer
challenge.toXDR();                             // Export as XDR string
challenge.isValid(serverPublicKey, options?); // Returns boolean
```

#### Verify Options

```typescript
interface VerifyChallengeOptions {
  homeDomain?: string;
  webAuthDomain?: string;
  allowExpired?: boolean;
  now?: Date;
}
```

## Sep10Jwt

Decode and inspect JWT tokens.

### `fromToken(token)`

Parse a JWT token:

```typescript
const jwt = Sep10Jwt.fromToken(tokenString);
```

### Properties

| Property              | Type                      | Description                   |
| --------------------- | ------------------------- | ----------------------------- |
| `token`               | `string`                  | Raw JWT string                |
| `subject`             | `string?`                 | Account (G... or G...:memo)   |
| `issuer`              | `string?`                 | Token issuer                  |
| `expiresAt`           | `Date?`                   | Expiration time               |
| `issuedAt`            | `Date?`                   | Issue time                    |
| `jti`                 | `string?`                 | JWT ID                        |
| `homeDomain`          | `string?`                 | SEP-10 home domain            |
| `webAuthDomain`       | `string?`                 | SEP-10 web auth domain        |
| `clientDomain`        | `string?`                 | SEP-10 client domain          |
| `memo`                | `string?`                 | Memo if present               |
| `muxedAccountId`      | `string?`                 | Muxed account ID if present   |
| `isExpired`           | `boolean`                 | Whether token has expired     |
| `timeUntilExpiration` | `number?`                 | Milliseconds until expiration |
| `claims`              | `Record<string, unknown>` | All claims                    |

## Error Handling

Errors follow the `SEP10_CHAL_XXX` format for challenge errors and `SEP10_CLI_XXX` for client errors. Import error classes from:

```typescript
import { ChallengeErrors, ClientErrors } from "@colibri/sep10";

// ChallengeErrors.INVALID_XDR, ChallengeErrors.CHALLENGE_EXPIRED, etc.
// ClientErrors.FETCH_CHALLENGE_FAILED, ClientErrors.TIMEOUT, etc.
```
