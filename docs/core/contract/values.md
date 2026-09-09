# Soroban types and validated values

`SorobanType` provides descriptive TypeScript types and optional runtime
validation. Contract calls continue to accept ordinary JavaScript values, and
results remain ordinary values. A type annotation describes the ABI meaning;
calling `.from()` checks the value and gives you encoding utilities.

Install `jsr:@colibri/core@^1.1.0`. Save a complete example below as `values.ts`
and run `deno run values.ts`; these examples need no RPC or signer. Import
`SorobanType` from the Core root, or use
`import * as SorobanType from "@colibri/core/values"` for lightweight consumers.
The direct namespace import lets Deno discard unused codecs; forwarding the
named namespace retains more code in Deno 2.9.6. Both use the same codec
implementations. See the
[values API reference](https://jsr.io/@colibri/core/doc/values).

## Validate a primitive

<!-- deno-check -->

```ts
import { SorobanType } from "@colibri/core";

const count: SorobanType.U32 = 7;
const role: SorobanType.Symbol = "ADMIN";
const validated = SorobanType.Symbol.from(role);

console.log(count, validated.value);
console.log(validated.toXdr("base64"));
console.log(SorobanType.Symbol.fromScVal(validated.toScVal()).value);
```

Ordinary strings and numbers remain assignable to these types. Type metadata is
optional and adds no fields to runtime values. It lets composed declarations
retain distinctions such as Symbol versus String when deriving wrapper inputs.
For example, `SorobanType.Input.U32` accepts a number or a compatible validated
U32 value. It does not convert a validated I32 into a U32 implicitly.

`SorobanType.Symbol.from("ADMIN!")`, `SorobanType.U32.from(-1)` and fractional
U32 values throw `SorobanValueError`. Codes distinguish invalid values
(`SV_001`), incompatible wrapped types (`SV_002`) and invalid schemas
(`SV_003`). Type and reason are in `meta.data`; codec failures retain their
cause. Validation checks representation and ABI compatibility, not authorization
or business rules.

A codec provides `.from()`, `.encode()`, `.decode()`, `.fromScVal()` and
`.fromXdr()`. Wrapped values expose `.value`, `.toScVal()` and `.toXdr()`.
Mutable inputs are copied, and returned arrays, buffers and XDR objects are
detached copies. `.toXdr("hex")` and `.toXdr("base64")` return strings.

## Supported types

| Family      | SorobanType members and decoded representations                                  |
| ----------- | -------------------------------------------------------------------------------- |
| Basic       | Bool (boolean), Void (null), Error (`{ type, code }`)                            |
| Integers    | U32/I32 (number), U64/I64/U128/I128/U256/I256 (bigint)                           |
| Time        | Timepoint (u64 Unix seconds), Duration (u64 seconds), both bigint                |
| Text        | Symbol (up to 32 ASCII letters, digits or underscores), String                   |
| Binary      | Bytes and BytesN, using Uint8Array                                               |
| Addresses   | Address accepts G/C; MuxedAddress accepts G/C/M and preserves its ID             |
| Composition | Vec, Map, Tuple, Option and Result                                               |
| Custom      | Structs, tuple structs, tagged enums and numeric enums                           |
| Generic     | Val: decoded ABI values are unknown; its explicit codec preserves ScVal payloads |

Time codecs do not implicitly convert JavaScript milliseconds. String codecs
accept text or bytes: `.value` uses the SDK's text decoding, including
replacement characters for invalid UTF-8, while XDR methods preserve the
original bytes. `SorobanType.BytesN(32)` builds a codec that checks an exact
byte length.

System members `ContractInstance`, `LedgerKeyContractInstance`, `LedgerKeyNonce`
and `ExecutableTag` preserve their complete wire payloads. They support ledger
inspection and are rejected as ordinary contract arguments. `Val` can also
retain nullable wire containers and address arms that ordinary contract codecs
reject. Coverage follows the supported SDK/XDR version.

## Compose types and values

Container codecs take explicit inner codecs, so empty containers remain typed.
Inputs can mix ordinary and validated values at any depth.

<!-- deno-check -->

```ts
import { SorobanType } from "@colibri/core";

const indexes = SorobanType.Vec(SorobanType.U32);
const roles = SorobanType.Map(SorobanType.Symbol, indexes);
const value = roles.from([
  ["ADMIN", [1, SorobanType.U32.from(2)]],
]);
const absent = SorobanType.Option(SorobanType.U32).from(null);
const pair = SorobanType.Tuple(
  [
    SorobanType.Symbol,
    SorobanType.U32,
  ] as const,
).from(["ADMIN", 7]);

const decoded: SorobanType.Map<
  SorobanType.Symbol,
  SorobanType.Vec<SorobanType.U32>
> = value.value;
console.log(decoded, absent.value, pair.value);
```

Map encoding sorts keys using Soroban's comparison rules and rejects duplicate
keys. Decoding rejects unordered maps. Vector and tuple positions are preserved.
Enum declarations do not need ascending numeric codes; their exact codes and
payload positions are preserved. Map ordering also applies when keys are enums
or other composed values.

Option and Result are compositions, with no separate ScVal tags. None encodes
void and Some encodes its inner value; Some(void) cannot be distinguished on the
wire. Result codecs use `{ ok: value }` or `{ error: value }`; Err encodes
ScError. An Ok payload cannot itself encode ScError. Top-level method results
continue to use the SDK's existing Result API; explicit branch objects describe
nested Results and helper values.

## Declare custom types

The bindings generator emits `SorobanType.Custom` schemas. Colibri derives the
SDK-compatible field and variant shapes internally, so generated files do not
repeat `tag` and `values` objects for each variant or duplicate input fields.

<!-- deno-check -->

```ts
import type { SorobanType } from "@colibri/core";

export type RbacStorage = SorobanType.Custom<{
  kind: "enum";
  encoding: "tagged";
  variants: {
    ExistingRoles: SorobanType.Void;
    RoleIndexToAccount: [SorobanType.Symbol, SorobanType.U32];
  };
}>;

export type Status = SorobanType.Custom<{
  kind: "enum";
  encoding: "u32";
  variants: { Pending: 1; Active: 10; Closed: 20 };
}>;

export type Summary = SorobanType.Custom<{
  kind: "struct";
  fields: { status: Status; keys: SorobanType.Vec<RbacStorage> };
}>;

export type SummaryInput = SorobanType.Input.Custom<Summary>;
```

`kind: "tuple"` uses a positional `fields` tuple. Tagged enums use Void for a
payload-free case or a tuple for its fields, including `[]` for a tuple case
with zero fields. Both retain the variant name in XDR. Numeric enums retain
explicit u32 codes; unknown codes and invalid payloads are rejected. Containers
and custom declarations may nest, including recursive optional fields.

## Use generated factories

Regenerate your client with the
[bindings CLI](../../packages/contract-bindings.md). Each custom type has a
matching factory bound to the embedded spec. This fragment assumes `contract` is
your configured client and your generated contract declares the RbacStorage type
shown above:

```ts
import { SorobanType } from "@colibri/core";
import { RbacStorage } from "./generated/index.ts";

const key = RbacStorage.RoleIndexToAccount(
  SorobanType.Symbol.from("ADMIN"),
  7,
);
const entry = await contract.getLedgerEntry({ key, durability: "persistent" });
```

Structs use `Summary.from(fields)`. Numeric enums expose their exact codes and
validation on one factory: `Status.Active` and `Status.from(Status.Active)`. All
factories expose `.type`, `.fromScVal()` and `.fromXdr()`. There is no separate
`NameType` factory. Referenced error types select codes from the existing
categorized error map through `SorobanType.ErrorCode`; no duplicate error enum
or registry is emitted.

The generator binds factories with
`SorobanType.Custom.fromSpec<Summary>(() => ContractSpec, "Summary")`.
TypeScript generics are erased; runtime validation uses that spec. Handwritten
generic declarations must accurately describe it. Factories snapshot dependent
ABI declarations when first used, and reject incompatible wrapped schemas even
when their type names match. They do not infer storage durability or the value
stored under a key. `SorobanCodec` is the reusable encoding/decoding class.

## Existing contract behavior

`Contract.read()`, `invoke()` and `deploy()` accept helpers alongside raw
values. Generated clients retain existing pipelines, signing, plugin ordering,
submission and transaction metadata. Event filters and ledger keys also accept
validated values. Method outputs stay plain; wrap them explicitly when needed.

The SDK's native `Spec` constructor is unchanged. Use
`encodeSorobanArguments(spec, method, args)` when building a native operation
manually. Raw `readRaw()`/`invokeRaw()` interfaces and direct Stellar SDK calls
receive `value.toScVal()`. Other JavaScript APIs expecting a primitive receive
`value.value`. Existing standalone helper constructors still work; the namespace
is the primary API for new code and generated declarations.
