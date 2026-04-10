# SEP-1

Utilities for parsing [stellar.toml](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md) files.

## StellarToml

### `fromDomain(domain, options?)`

Fetch and parse stellar.toml from a domain:

```typescript
import { StellarToml } from "@colibri/core";

const toml = await StellarToml.fromDomain("anchor.example.com");
```

#### Options

```typescript
interface FetchTomlOptions {
  fetchFn?: typeof fetch; // Custom fetch implementation
}
```

### `fromString(tomlString, options?, domain?)`

Parse a TOML string directly:

```typescript
const toml = StellarToml.fromString(tomlContent);

// With domain (useful for SEP-10)
const toml = StellarToml.fromString(tomlContent, {}, "anchor.example.com");
```

### Properties

| Property              | Type                      | Description                      |
| --------------------- | ------------------------- | -------------------------------- |
| `domain`              | `string?`                 | Domain the TOML was fetched from |
| `networkPassphrase`   | `string?`                 | Network passphrase               |
| `webAuthEndpoint`     | `string?`                 | SEP-10 auth endpoint             |
| `signingKey`          | `string?`                 | Server signing key               |
| `transferServer`      | `string?`                 | SEP-6 transfer server            |
| `transferServerSep24` | `string?`                 | SEP-24 transfer server           |
| `kycServer`           | `string?`                 | SEP-12 KYC server                |
| `directPaymentServer` | `string?`                 | SEP-31 direct payment server     |
| `anchorQuoteServer`   | `string?`                 | SEP-38 quote server              |
| `accounts`            | `string[]`                | Listed accounts                  |
| `currencies`          | `Currency[]`              | Listed currencies                |
| `validators`          | `Validator[]`             | Listed validators                |
| `raw`                 | `Record<string, unknown>` | Raw parsed TOML                  |

### `hasWebAuth()`

Check if the TOML has SEP-10 web authentication configured:

```typescript
if (toml.hasWebAuth()) {
  // Domain supports SEP-10 authentication
  const client = Sep10Client.fromToml(toml);
}
```

Returns `true` if both `webAuthEndpoint` and `signingKey` are present.

### `sep10Config`

Get SEP-10 configuration:

```typescript
const sep10 = toml.sep10Config;
// { webAuthEndpoint, signingKey }
```

## Error Handling

Errors follow the `SEP1_XXX` format. Import from:

```typescript
import * as E from "@colibri/core/sep1/error";

// E.FETCH_FAILED, E.INVALID_TOML, etc.
```
