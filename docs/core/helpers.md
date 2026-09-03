# Shared helpers and binary values

Core exports reusable helpers as well as high-level clients. Import them from
`@colibri/core`; source-directory paths and the repository's `@/` alias are not
consumer import paths.

## Decimal amounts

Use strings for human-readable amounts and `bigint` for base units to avoid
JavaScript floating-point rounding. These helpers do not query an asset's
decimal precision; supply it from the relevant protocol or contract.

<!-- deno-check -->

```ts
import { fromDecimals, toDecimals } from "@colibri/core";

const stroops = fromDecimals("1.2345678", 7);
console.log(stroops); // 12345678n
console.log(toDecimals(stroops, 7)); // "1.2345678"
```

Excess fractional digits are rejected by default. `excessFraction: "truncate"`
explicitly truncates toward zero. `toDecimals` can trim trailing zeros or cap
fraction digits without rounding. A `bigint` input to `fromDecimals` is already
in base units and passes through; it is not multiplied by the scale.

## XDR and byte helpers

Stellar SDK 17 uses canonical class-based XDR and `Uint8Array`. Use SDK
`toXdr()`/`fromXdr()` for serialization and Colibri's binary helpers for
supported conversions; do not add a `Buffer` dependency to application code just
to call Colibri.

Colibri's exported `xdr` is a helper namespace, **not** the SDK XDR constructor
namespace. Alias them when both are needed:

<!-- deno-check -->

```ts
import {
  operationHasDelegatedAuthorization,
  xdr as authXdr,
} from "@colibri/core";
import { xdr as stellarXdr } from "npm:@stellar/stellar-sdk";

const value = stellarXdr.ScVal.scvBool(true);
console.log(value.toXdr());
console.log(typeof authXdr.getAddressSignerFromAuthEntry);
console.log(typeof operationHasDelegatedAuthorization);
```

Auth-entry helpers extract the represented address, credentials, and signatures;
`operationHasDelegatedAuthorization(operation)` identifies delegated credential
entries on an invoke-host-function operation. These are structural tools, not
cryptographic authorization verification.

## Other reusable surfaces

- Assertions and type guards narrow inputs and fail with the supplied error.
- String/boolean parsing and bounded-array helpers validate common input forms.
- Transaction helpers classify/convert envelopes and inspect RPC results.
- `parseFailedSimulationResponse` and
  `getContractErrorFromFailedSimulationResponse` expose diagnostic information
  without running a new simulation.
- Memoization/deferred helpers support reusable clients and asynchronous flows.

Use the [Core API index](https://jsr.io/@colibri/core/doc) for exact individual
helper signatures and
[all helper error contexts](../reference/errors/README.md). Do not assume a
parse/type guard proves on-chain existence or authorization.
