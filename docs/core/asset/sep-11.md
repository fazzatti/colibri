# SEP-11

[SEP-11](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0011.md) defines a standardized way to represent Stellar assets as strings.

## Format

- **Native XLM**: `"native"`
- **Issued assets**: `"CODE:ISSUER"` (e.g., `"USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"`)

## Functions

### isStellarAssetCanonicalString

Check if a value is a valid SEP-11 asset string:

```typescript
import { isStellarAssetCanonicalString } from "@colibri/core";

isStellarAssetCanonicalString("native"); // true
isStellarAssetCanonicalString(
  "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
); // true
isStellarAssetCanonicalString("invalid"); // false
isStellarAssetCanonicalString(123); // false (type guard)
```

### parseStellarAssetCanonicalString

Parse a SEP-11 string into code and issuer:

```typescript
import { parseStellarAssetCanonicalString } from "@colibri/core";

parseStellarAssetCanonicalString("native");
// { code: "XLM", issuer: undefined }

parseStellarAssetCanonicalString(
  "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
);
// { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" }
```

### isNativeStellarAssetCanonicalString

Check if a SEP-11 asset is native XLM:

```typescript
import { isNativeStellarAssetCanonicalString } from "@colibri/core";

isNativeStellarAssetCanonicalString("native"); // true
isNativeStellarAssetCanonicalString("USDC:GA5Z..."); // false
```

### toStellarAssetCanonicalString

Create a SEP-11 string from code and issuer:

```typescript
import { toStellarAssetCanonicalString } from "@colibri/core";

toStellarAssetCanonicalString("XLM"); // "native"
toStellarAssetCanonicalString("native"); // "native"
toStellarAssetCanonicalString(
  "USDC",
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
);
// "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

// Throws if issuer is missing for non-native asset
toStellarAssetCanonicalString("USDC"); // Error: Issuer required for non-native asset: USDC
```

## Type

```typescript
type StellarAssetCanonicalString = `${string}:${string}` | "native";
```

## Validation Rules

The `isStellarAssetCanonicalString` function validates:

1. **Type check**: Value must be a string
2. **Native format**: `"native"` is always valid
3. **Colon format**: Must contain exactly one colon (`:`)
4. **Asset code**: 1-12 alphanumeric characters before the colon
5. **Issuer**: Valid Stellar Ed25519 public key (G...) after the colon

```typescript
// Valid examples
isStellarAssetCanonicalString("native"); // true
isStellarAssetCanonicalString("X:GA5Z..."); // true (1 char code)
isStellarAssetCanonicalString("ABCDEFGHIJKL:GA5Z..."); // true (12 char code)

// Invalid examples
isStellarAssetCanonicalString(""); // false (empty)
isStellarAssetCanonicalString("USDC"); // false (no colon)
isStellarAssetCanonicalString("USDC:INVALID"); // false (invalid issuer)
isStellarAssetCanonicalString("TOOLONGASSETCODE:GA5Z..."); // false (code > 12 chars)
isStellarAssetCanonicalString("USD-C:GA5Z..."); // false (non-alphanumeric)
isStellarAssetCanonicalString(":GA5Z..."); // false (empty code)
```

## See Also

- [Stellar Asset Contract](stellar-asset-contract.md) — Interacting with wrapped assets
- [SEP-11 Specification](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0011.md)
