# Validated Soroban values

Colibri accepts ordinary JavaScript values in contract calls. Validated Soroban
helpers add an optional check before encoding: a symbol must fit the symbol
alphabet and length, an integer must fit its range, and a custom value must
match its contract declaration. They do not prove authorization, available
balances, or other contract business rules.

Install `jsr:@colibri/core@^1.1.0`. The examples below run locally without RPC
or signers. Save a complete example as `values.ts` and run `deno run values.ts`.
The helpers are also available from `@colibri/core/values`, which avoids Colibri
client and pipeline initialization. See the
[API reference](https://jsr.io/@colibri/core/doc/values).

## Validate and encode a value

<!-- deno-check -->

```ts
import { SorobanSymbol, SorobanU32 } from "@colibri/core";

const role = new SorobanSymbol("ADMIN");
const index = new SorobanU32(7);

console.log(role.value); // "ADMIN"
console.log(index.value); // 7
console.log(role.toXdr("base64"));

const decoded = SorobanSymbol.type.fromScVal(role.toScVal());
console.log(decoded.value); // "ADMIN"
```

`new SorobanSymbol("ADMIN!")`, `new SorobanU32(-1)`, and fractional u32 values
throw `SorobanValueError`. Its stable codes distinguish invalid values
(`SV_001`), incompatible wrapped types (`SV_002`), and invalid schemas
(`SV_003`). Type and reason are available in `meta.data`; underlying codec
failures are retained in `meta.cause`.

Values snapshot their inputs. `.value`, `.toScVal()`, and raw `.toXdr()` return
detached data: editing an array or buffer obtained from them does not mutate the
wrapper. `.toXdr("hex")` and `.toXdr("base64")` return strings. Each `.type`
codec provides `.from()`, `.encode()`, `.decode()`, `.fromScVal()`, and
`.fromXdr()`.

## Supported types

| Family      | Helpers and native representation                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Basic       | `SorobanBool` (boolean), `SorobanVoid` (null; accepts undefined), `SorobanError` (`{ type, code }`) |
| Integers    | `SorobanU32`/`SorobanI32` (number), U64/I64/U128/I128/U256/I256 (bigint)                            |
| Time        | `SorobanTimepoint` (u64 Unix seconds), `SorobanDuration` (u64 seconds), both bigint                 |
| Text        | `SorobanSymbol` (up to 32 ASCII letters, digits or underscores), `SorobanString`                    |
| Binary      | `SorobanBytes` and `SorobanBytesN`, using Uint8Array                                                |
| Addresses   | `SorobanAddress` accepts G/C; `SorobanMuxedAddress` accepts G/C/M and preserves the muxed ID        |
| Composition | `SorobanVec`, `SorobanMap`, `SorobanTuple`, `SorobanOption`, `SorobanResult`                        |
| Custom      | Generated struct, tuple-struct, tagged-union, numeric-enum and contract-error codecs                |
| Wire values | `SorobanVal` preserves any supported native ScVal without lossy conversion                          |

Time helpers do not implicitly convert JavaScript milliseconds. Fixed bytes use
`new SorobanBytesN(bytes, 32)` or the reusable `SorobanBytesN.type(32)`
descriptor. String helpers accept text or bytes; `.value` uses the SDK's text
decoding (invalid UTF-8 becomes replacement characters), while `.toScVal()` and
`.toXdr()` preserve the original bytes. The generic `SorobanVal.value` is a
detached native ScVal so its original type and full payload remain available.

System-only values have explicit helpers: `SorobanContractInstance`,
`SorobanLedgerKeyContractInstance`, `SorobanLedgerKeyNonce`, and
`SorobanExecutableTag`. They preserve complete ledger/XDR payloads, including
instance storage and executable details. They are not valid ordinary contract
arguments. Claimable-balance/liquidity-pool address arms and nullable wire
containers can be retained through `SorobanVal`; the ordinary contract codecs
enforce the narrower host-facing rules. Coverage follows the supported SDK/XDR
version, not unactivated protocol proposals.

## Compose values

Containers take explicit schemas, which also describe empty containers. Native
values and wrappers can be mixed at any depth.

<!-- deno-check -->

```ts
import {
  SorobanMap,
  SorobanOption,
  SorobanSymbol,
  SorobanTuple,
  SorobanU32,
  SorobanVec,
} from "@colibri/core";

const indexes = new SorobanVec([1, new SorobanU32(2)], SorobanU32.type);
const roles = new SorobanMap(
  [["ADMIN", indexes]],
  SorobanSymbol.type,
  SorobanVec.type(SorobanU32.type),
);
const key = new SorobanTuple(
  [new SorobanSymbol("ADMIN"), 7],
  [SorobanSymbol.type, SorobanU32.type] as const,
);
const absent = new SorobanOption(null, SorobanU32.type);
console.log(roles.value, key.value, absent.value);
```

Map helpers sort keys using Soroban's content-wise ordering and reject duplicate
encoded keys. Decoding rejects unordered maps. Canonical valid raw and wrapped
values encode identically. Existing raw SDK calls retain their original
conversion behavior.

Option and Result are ABI compositions, not separate ScVal tags. `None` encodes
void; `Some` uses its inner value. Consequently a separate `Some(void)` cannot
be distinguished on the wire. Result helpers use `{ ok: value }` or
`{ error: value }`: Ok encodes its payload directly, while Err encodes ScError.
A contract error enum supplies a u32 contract code. An Ok value cannot itself
encode ScError. Existing top-level method results continue using the native SDK
`Result` API; the explicit branch objects are for helper values and nested
Results.

## Use generated custom values

Regenerate bindings with the
[bindings CLI](../../packages/contract-bindings.md). The constants/spec/error
layout stays the same. In `types.ts`, inputs use aliases such as
`SorobanSymbolInput` and `SorobanU32Input`; outputs use descriptive native
aliases that remain string and number. Contract types keep their spec-derived
names. If a new custom input alias conflicts with a method input, its name uses
the suffix `ValueInput`.

For a contract declaring `RbacStorage.RoleIndexToAccount(Symbol, u32)`, the
generated API supports this fragment (`contract` is your configured client):

```ts
import { SorobanSymbol, SorobanU32 } from "@colibri/core";
import { RbacStorage } from "./generated/index.ts";

const key = RbacStorage.RoleIndexToAccount(
  new SorobanSymbol("ADMIN"),
  new SorobanU32(7),
);
const entry = await contract.getLedgerEntry({ key, durability: "persistent" });
```

Structs provide `SomeStruct.from(fields)`; unions provide a constructor per
exact ABI tag. Both expose `.type`, `.fromScVal()`, and `.fromXdr()`. Numeric
enums keep their existing enum object and receive a separate `NameType` factory.
Referenced error codes reuse the existing definitions, without duplicate error
enums. Factories snapshot their dependent spec declarations when their codec is
first used. Matching a type name alone is insufficient: wrapped custom inputs
must match the expected dependent ABI shape.

`createSorobanType<Input, Output>(spec, name)` and
`sorobanTypeFromSpec(spec, typeDescriptor)` support manually configured codecs.
Generated types are preferable to handwritten generic claims about a runtime
spec. Neither facility infers storage durability or the type stored under a key.

## Compatibility and invocation

`Contract.read()`, `invoke()`, and `deploy()` accept nested helpers alongside
raw values. Generated clients use these same methods and existing pipelines.
Event topic filters and contract-data ledger-key helpers also accept validated
values. Simulation, signing, plugin ordering, submission, and transaction
metadata remain unchanged. Method outputs stay plain by default; wrap a result
explicitly when you need its codec utilities.

Native `Spec` remains the SDK's exact constructor. Its own methods do not accept
these arbitrary classes automatically. Use
`encodeSorobanArguments(spec, method,
args)` when building a native operation
for a pipeline yourself. Existing `readRaw()`/`invokeRaw()` TypeScript
signatures remain native ScVal interfaces for custom-client compatibility: pass
`value.toScVal()` there and when calling the Stellar SDK directly. Other
JavaScript APIs expecting a primitive should receive `value.value`.
