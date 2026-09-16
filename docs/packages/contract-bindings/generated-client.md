# Generated clients and values

## Understand the generated types

Every callable ABI method has a property with **both** `.read()` and
`.invoke()`. The ABI does not say which functions write state; choose simulation
with `.read()`, or transaction submission through Core's pipeline with
`.invoke()`.

This fragment assumes your generated `Token` class declares `balance` and
`transfer`, and that the addresses and transaction configuration are supplied by
your application:

```ts
const balance = await token.balance.read({ account: address });
const result = await token.transfer.invoke({
  methodArgs: { from: address, to: recipient, amount: 100n },
  config: transactionConfig,
});
console.log(balance, result.value, result.hash);
```

Reads accept the method's argument object directly. Invocations take one object
with `methodArgs`, `config`, and optional `auth`, just like generic `invoke`
without `method`. Argument-free functions use `.read()` and can omit
`methodArgs` from `.invoke({ config })`. Helpers remain bound to their client
when destructured. They delegate to the existing generic `client.read()` and
`client.invoke()` methods, which remain available with their existing call
shape.

Property names use camelCase: `grant_role` becomes `client.grantRole`, and
`get_URL` becomes `client.getUrl`. Names that collide after casing or with a
client member or JavaScript hook receive a `Method` suffix until unused. For
example, an ABI function `read` is exposed as `client.readMethod.read()`.
Normalized collisions are resolved in spec order. Warnings report collisions;
ordinary casing changes are expected. The generated README's function table
shows every mapping. Generic method keys, argument fields, and the ABI method
names sent to Core stay unchanged.

Soroban runs `__constructor` during deployment, so generated clients omit it
from convenience properties, `ContractMethods`, and their callable method maps.
The embedded spec retains its declaration, and `ConstructorInput` describes its
deployment arguments. This is separate from the JavaScript client constructor's
configuration type. The generated class keeps its normal JavaScript constructor.

Method names remain correlated with their arguments and outputs. No-argument
functions can omit `methodArgs`. Invoke keeps Core's raw `returnValue`, hash,
ledger, timestamp, and RPC response and adds `value`; it is undefined when Core
has no return value.

The types match SDK decoding: large integers are bigint; bytes are Uint8Array;
void is null; missing Options decode to null; Maps decode to arrays of tuples.
Map inputs can also be JavaScript Maps, and Option inputs accept undefined.
Structs, tuple structs, tagged unions, and enums retain their native shapes.
Fixed byte sizes and integer bounds are runtime codec constraints. Top-level
Result uses the SDK Result wrapper with `{ message: string }` errors;
transaction failures may also throw Core errors. Unsupported SDK encodings such
as nested Result fail generation explicitly.

Types retain their spec names in PascalCase, such as `CounterSummary`. Functions
have named `GetCountInput`/`GetCountOutput` types and appear in the client
method map. Custom declarations have separate factory argument aliases,
described under [validated contract values](#validated-contract-values).
Repeated original names use the first SDK declaration with a warning. Casing
collisions fail explicitly instead of introducing numerical type prefixes.

`ContractMethods` exposes PascalCase enum members with the exact ABI strings as
values, such as `GrantRole = "grant_role"`. Both `ContractMethods.GrantRole` and
`"grant_role"` retain correlated argument and return types in calls. Casing
collisions fail generation. Alias this import when combining several generated
clients in one module.

The generated class inherits `getLedgerEntry({ key, durability })` from Core for
direct contract-data reads. It supplies its contract ID and RPC automatically;
provide an encoded ScVal key and persistent/temporary durability (persistent by
default). It returns the existing ledger helper's parsed entry and raw metadata,
without a generated storage schema. See
[direct ledger reads](../../core/contract/invocation.md#getledgerentry).

## Validated contract values

Newly generated inputs accept raw values and
[validated Soroban helpers](../../core/contract/values.md). Output aliases such
as `SorobanType.U32` retain plain result shapes. Custom types use
`SorobanType.Custom` schemas, with struct/tuple fields or tagged/u32 enum
variants. Matching factories reuse the embedded spec. Numeric codes and
validation live on one factory. Each custom declaration has a `NameArgs` alias
for the values accepted by its factory, while method arguments retain their
`MethodInput` names. Method input fields reuse the custom `NameArgs` aliases. If
`NameArgs` collides with a contract type, the factory alias uses
`NameValueArgs`.

For example, if your spec declares a `TtlConfig` struct with `threshold` and
`extend_to` U32 fields, the generated declarations can be used like this:

```ts
import { TtlConfig, type TtlConfigArgs } from "./token-client/types.ts";
import { SorobanType } from "./token-client/colibri.ts";

const args: TtlConfigArgs = {
  threshold: 100,
  extend_to: SorobanType.U32.from(1_000),
};
const config = TtlConfig.from(args);
const encoded = config.toScVal();
const restored: TtlConfig = TtlConfig.fromScVal(encoded).value;
console.log(restored.threshold);
```

The type and runtime factory deliberately share the name `TtlConfig`: type
annotations describe decoded fields, while `.from()` validates construction
arguments. `TtlConfigArgs` describes those arguments, not a contract method's
parameters. Factories also expose `.type` and `.fromXdr()`; validated instances
expose `.value`, `.toScVal()` and `.toXdr()`.

Tagged enums offer variant constructors, such as
`RbacStorage.RoleIndexToAccount("ADMIN", 0)` for a matching spec declaration.
Numeric enum factories preserve their declared codes, such as `Status.Active`,
and validate them through `Status.from(Status.Active)`. Tuple fields and enum
payload positions retain their declared order; only map keys are canonically
sorted during encoding. See the
[Soroban value guide](../../core/contract/values.md) for complete struct, tuple,
enum and container examples.

A generated storage-key value can be passed to
`client.getLedgerEntry({ key, durability: "persistent" })`. Supply the correct
durability and interpret the returned storage value yourself: a key type in the
spec does not describe the contract's complete storage layout.

[Package overview](../contract-bindings.md)
