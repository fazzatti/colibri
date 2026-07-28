# SEP-1

Utilities for parsing
[stellar.toml](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md)
files.

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

| Property                      | Type                      | Description                          |
| ----------------------------- | ------------------------- | ------------------------------------ |
| `domain`                      | `string?`                 | Domain the TOML was fetched from     |
| `networkPassphrase`           | `string?`                 | Network passphrase                   |
| `webAuthEndpoint`             | `string?`                 | SEP-10 auth endpoint                 |
| `webAuthForContractsEndpoint` | `string?`                 | SEP-45 auth endpoint                 |
| `webAuthContractId`           | `string?`                 | SEP-45 WebAuth contract ID           |
| `signingKey`                  | `string?`                 | Server signing key                   |
| `transferServer`              | `string?`                 | SEP-6 transfer server                |
| `transferServerSep24`         | `string?`                 | SEP-24 transfer server               |
| `kycServer`                   | `string?`                 | SEP-12 KYC server                    |
| `directPaymentServer`         | `string?`                 | SEP-31 direct payment server         |
| `anchorQuoteServer`           | `string?`                 | SEP-38 quote server                  |
| `accounts`                    | `string[]`                | Listed accounts                      |
| `currencies`                  | `Currency[]`              | Listed currencies                    |
| `validators`                  | `Validator[]`             | Listed validators                    |
| `raw`                         | `Record<string, unknown>` | Raw parsed TOML                      |

### `hasWebAuth()`

Check if the TOML has SEP-10 web authentication configured:

```typescript
if (toml.hasWebAuth()) {
  // Domain supports SEP-10 authentication
  const client = Sep10Client.fromToml(toml);
}
```

Returns `true` if both `webAuthEndpoint` and `signingKey` are present.

### `hasWebAuthForContracts()`

Returns `true` when `WEB_AUTH_FOR_CONTRACTS_ENDPOINT`, `WEB_AUTH_CONTRACT_ID`,
and `SIGNING_KEY` are all present.

### `sep10Config`

Get SEP-10 configuration:

```typescript
const sep10 = toml.sep10Config;
// { webAuthEndpoint, signingKey }
```

### `sep45Config`

Get complete SEP-45 configuration:

```typescript
const sep45 = toml.sep45Config;
// { webAuthEndpoint, signingKey, contractId, networkPassphrase? }
```

### `webAuthConfig`

Get normalized discovery data for every completely advertised WebAuth
protocol. The method is additive: existing SEP-10 getters and completeness
rules are unchanged.

```typescript
const webAuth = toml.webAuthConfig;
// {
//   homeDomain,
//   signingKey,
//   networkPassphrase?,
//   sep10?: { endpoint },
//   sep45?: { endpoint, contractId },
// }
```

`webAuthConfig` is `undefined` when the TOML has no retained source domain, no
valid signing key, or neither protocol is completely configured.

## Error Handling

Errors follow the `SEP1_XXX` format. Import from:

```typescript
import { ERRORS_SEP1 } from "@colibri/core";

// ERRORS_SEP1.FETCH_FAILED, ERRORS_SEP1.PARSE_ERROR, etc.
```
