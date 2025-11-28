# SEP-11

[SEP-11](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0011.md) defines a standardized way to represent Stellar assets as strings.

## Format

- **Native XLM**: `"native"`
- **Issued assets**: `"CODE:ISSUER"` (e.g., `"USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"`)

## Functions

### isSEP11Asset

Check if a value is a valid SEP-11 asset string:

```typescript
import { isSEP11Asset } from "@colibri/core";

isSEP11Asset("native"); // true
isSEP11Asset("USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"); // true
isSEP11Asset("invalid"); // false
```

### parseSEP11Asset

Parse a SEP-11 string into code and issuer:

```typescript
import { parseSEP11Asset } from "@colibri/core";

parseSEP11Asset("native");
// { code: "XLM", issuer: undefined }

parseSEP11Asset(
  "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
);
// { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" }
```

### isNativeSEP11Asset

Check if a SEP-11 asset is native XLM:

```typescript
import { isNativeSEP11Asset } from "@colibri/core";

isNativeSEP11Asset("native"); // true
isNativeSEP11Asset("USDC:GA5Z..."); // false
```

### toSEP11Asset

Create a SEP-11 string from code and issuer:

```typescript
import { toSEP11Asset } from "@colibri/core";

toSEP11Asset("XLM"); // "native"
toSEP11Asset(
  "USDC",
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
);
// "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
```

## Type

```typescript
type SEP11Asset = `${string}:${string}` | "native";
```
