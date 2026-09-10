# Demo contract client

Typed [Colibri](https://jsr.io/@colibri/core) bindings generated from this
contract's specification. The client extends `Contract` and gives each callable
function a property with typed `.read()` and `.invoke()` calls.

## Files

| File | Contents |
| --- | --- |
| [constants.ts](constants.ts) | Method names, embedded spec, and error messages. |
| [types.ts](types.ts) | Sections for methods and their inputs/outputs/maps, contract types, events, and client configuration. |
| [index.ts](index.ts) | Client class and exports for the generated API. |
| [colibri.ts](colibri.ts) | Core configuration helpers and signer/transaction types. |

## Setup

```sh
deno add jsr:@colibri/core@^1.1.0
```

The JSR preset uses Colibri Core 1.1; Core supplies the Stellar SDK dependency. The generated source
imports only `@colibri/core` from your Deno import map.

## Create a client

Replace the deployment ID with your contract's address, and select its network.
For npm builds, import the generated client from your package's built entrypoint.

```ts
import { Demo } from "./index.ts";
import { NetworkConfig } from "./colibri.ts";

const client = new Demo({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { contractId: "C..." },
});
```

## Colibri conveniences

The generated `colibri.ts` module re-exports `NetworkConfig`, `LocalSigner`,
`SorobanType`, `ColibriError`, and common signer, contract and transaction types.
The client entrypoint also re-exports them unless an ABI declaration has the
same name. In that case, import the convenience directly from `colibri.ts`
(or the published package's `/colibri` entrypoint). ABI names take precedence.
These are the original Core exports, so constructor identity is preserved.
Core remains a runtime dependency. Existing package manifests are preserved
on regeneration; add the `/colibri` export manually when upgrading an older scaffold.

Use `LocalSigner.fromKeypair(keypair)` to adapt an existing native Stellar SDK
signing keypair, then pass that signer in `config.signers`. It targets only its
own G-address by default; other accounts or custom contract authorization need
explicit targets and the appropriate authority/encoding. Public-only keypairs
are rejected. The factory borrows the keypair without extracting its secret;
destroying the adapter leaves the original keypair unchanged. Transaction
configuration and signing pipelines continue to accept Colibri signers.

## Read a result

`read()` simulates the selected function and returns its decoded value.
It does not submit a transaction. Adjust the sample arguments for your deployment.

```ts
const value = await client.summary.read();
console.log(value);
```

## Submit a transaction

Provide your application's `TransactionConfig`, including the source account,
fee, timeout, and signers. The example below assumes that configuration is
available as `transactionConfig`.

```ts
const result = await client.increment.invoke({
  methodArgs: { by: 1 },
  config: transactionConfig,
});

console.log(result.hash);
console.log(result.value);
```

The spec does not classify functions as reads or writes. Every callable function
is available through both calls; choose simulation or submission deliberately.
`invoke()` preserves Colibri's transaction metadata and raw `returnValue`, and
adds the decoded `value`. That value is `undefined` if no return value is present.

Pass the function's argument object directly to `.read(args)`. Invocations take
one object: `.invoke({ methodArgs, config, auth })`, matching the generic call
with only `method` supplied by the helper. Argument-free functions use `.read()`
and can omit `methodArgs` from `.invoke({ config, auth })`.
The helpers remain bound to this client
when destructured. Existing generic `client.read({ method, methodArgs })`
and `client.invoke({ method, methodArgs, config, auth })` calls remain available.

## Soroban types and validated inputs

Generated declarations use `SorobanType.U32`, `SorobanType.Symbol`, and other
Soroban names. Method inputs use `SorobanType.Input` and accept ordinary values
or validated wrappers; decoded outputs remain ordinary JavaScript values.

Import `SorobanType` from the generated `colibri.ts` module. For example,
`SorobanType.U32.from(7)` checks the integer range and
`SorobanType.Symbol.from("ADMIN")` checks the symbol alphabet and length.
Wrappers expose `.value`, `.toScVal()` and `.toXdr("base64")`.

Custom declarations use `SorobanType.Custom` schemas: named struct fields,
positional tuple fields, or enum variants with tagged or u32 encoding. Colibri
derives their accepted inputs without repeating the fields or tag/value objects.
The runtime factories reuse this contract's embedded spec.

Use `SomeStruct.from(fields)` or `SomeEnum.Variant(...values)`, substituting
names from `types.ts`. Numeric enums expose their exact codes on the same
factory, such as `Status.Active`, and validate with `Status.from(code)`.
Factories also provide `.fromScVal()`, `.fromXdr()` and a reusable `.type`
codec. Numeric codes are never renumbered; map keys are ordered according to
Soroban's comparison rules. Referenced error codes reuse the existing error map.

Each custom declaration has a `NameArgs` alias for the raw or validated values
accepted by its factory. Method arguments keep `MethodInput` names and reuse
these aliases for custom fields. If `NameArgs` collides with a contract type,
the factory alias uses `NameValueArgs`; the contract type keeps its spec name.

## Read contract data

The inherited `getLedgerEntry()` uses this client's contract ID and RPC. Given
an `encodedKey` ScVal or generated custom value in your contract's storage-key encoding:

```ts
const entry = await client.getLedgerEntry({
  key: encodedKey,
  durability: "persistent",
});
console.log(entry.value, entry.liveUntilLedgerSeq);
```

Durability defaults to `"persistent"`; `"temporary"` is also supported.
This reads ledger data directly, without simulation or signing. It returns the
existing Colibri contract-data entry, including parsed values, raw XDR and ledger
metadata. Missing entries raise the existing ledger not-found error. No storage
schema is inferred.

## Functions

| ABI method | Client property | Input type | Output type |
| --- | --- | --- | --- |
| `summary` | `client.summary` | `SummaryInput` | `SummaryOutput` |
| `get_count` | `client.getCount` | `GetCountInput` | `GetCountOutput` |
| `increment` | `client.increment` | `IncrementInput` | `IncrementOutput` |
| `echo_summary` | `client.echoSummary` | `EchoSummaryInput` | `EchoSummaryOutput` |

Use `ContractMethods` for PascalCase method constants and `DemoMethodMap` for correlated
inputs and outputs. ABI type names use PascalCase. Field names and union tags
retain their on-chain spelling so they remain compatible with the SDK codec.

Client properties use camelCase: `grant_role` becomes `client.grantRole`.
Names that collide after casing or with existing client members or JavaScript
hooks receive a `Method` suffix, repeated if necessary to avoid another name.
The table shows the exact
property. Normalized collisions are resolved in spec order. The ABI name passed
to Colibri, generic method keys, argument fields and union tags never change.


## Contract errors

`DemoErrors` satisfies Colibri's `ContractErrorMap` type. The client installs
it once during construction. Each entry retains the spec case name as `name`
and its declaring error enum as `category`, alongside `message` and optional
`details`. Error-only enums are not duplicated in `types.ts`. Customize messages
before creating a client, preserving the original metadata:

```ts
import { DemoErrors } from "./index.ts";

const errors = {
  ...DemoErrors,
  1: {
    ...DemoErrors[1],
    message: "A message tailored to your application.",
  },
};

const customized = new Demo({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { contractId: "C..." },
  errors,
});
```

Automatic matching uses the configured contract ID. Without an ID, it matches
errors from the root invocation. Pass `errors: false` if you provide your own
matcher through `contractConfig.plugins`; other configured plugins are preserved.
Matched errors expose `name` and `category` in `error.meta.data.match`.

If decoding fails after a transaction succeeds, Core error `CONTR_021` retains the successful
transaction in `error.meta.data.result`. Inspect it before retrying; do not
resubmit the transaction automatically.

## Events

The contract declares 1 event. Each definition supports typed
decoding and filters for its indexed fields.

```ts
const definition = client.events["CountChanged"];
const filter = definition.toEventFilter();

// Decode an Event returned by Colibri's event APIs.
const decoded = definition.fromEvent(event);
console.log(decoded.fields);
```

- **CountChanged**: Emitted after the counter changes; action can be used in event filters.

Use the named property on `client.events` for field-specific autocomplete.
For example, `client.events["CountChanged"]` exposes the event's
payload and indexed topic types from `types.ts`.

## Native values

| Contract value | JavaScript representation |
| --- | --- |
| 32-bit integers | `number` |
| Integers of 64 bits and above | `bigint` |
| Bytes | `Uint8Array` |
| Option | Value or `null`; inputs also accept `undefined`. |
| Map | Array of `[key, value]` pairs; inputs also accept `Map`. |
| Void return | `null` |
| Top-level Result | Stellar SDK `Result` wrapper. |

A contract type has an additional `Input` variant only when its accepted input
shape differs from its decoded output. Fixed byte lengths and integer ranges
are validated by the SDK codec.

## Regeneration

Run the generator again with the same source and output directory. Add
`--force` to replace generated `constants.ts`, `types.ts`, and `index.ts`.
Existing README, package configuration, and handwritten files are preserved.
To refresh this guide, remove it explicitly before regenerating.

The embedded spec is a snapshot. Regenerate after an ABI change; loading a
different spec into this typed client invalidates its type guarantees.
Generation itself never submits transactions.
