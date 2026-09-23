# Generated errors and events

## Assemble errors and use events

For a generated `Token` class, `TokenErrors` maps numeric codes to
`{ name, category, message, details? }`. The case name and declaring error enum
come directly from the spec, while message and details can be customized.
Separate error enums are omitted; a numeric type alias remains only if another
ABI declaration references that error type. Supply a prepared `errors` object in
the constructor to customize messages. Automatic matching is installed once,
scoped to the contract ID when present, or to root-invocation errors before an
ID is available. Use `errors: false` when supplying your own matcher through
[`contractConfig.plugins`](../../core/contract/plugins.md#known-contract-errors).
Other constructor plugins keep their Core semantics. Spread the original entry
when customizing a message to retain its metadata. For example, this fragment
assumes your generated `TokenErrors` declares code `7` and your application
supplies `networkConfig` and `contractId`:

```ts
import { Token, TokenErrors } from "./token-client/index.ts";

const token = new Token({
  networkConfig,
  contractConfig: { contractId },
  errors: {
    ...TokenErrors,
    7: {
      ...TokenErrors[7],
      message: "Not authorized",
      details: "Ask the token administrator.",
    },
  },
});
```

Prepare the map before constructing the client; there is no additional mutable
error-installation method. Matched errors surface `name` and `category` in
`error.meta.data.match`. Core's spec/WASM helpers and
[`Contract.loadContractErrorsFromWasm()`](../../core/contract/plugins.md#known-contract-errors)
preserve these fields too; manually supplied maps may omit them.

`token.events.Transfer` is a Core event definition when that name is declared in
the ABI. Its `toTopicFilter` and `toEventFilter` accept only indexed fields.
`fromEvent` validates exact topic count and types and single-value, vector, or
map payloads. The resulting [`ContractEvent`](../../core/contract/events.md)
retains the original ledger, transaction, and raw-XDR information alongside
typed `fields` and `get()`.

For a declared `Transfer` event with an indexed `from` field and an `amount`
payload field, use the definition directly. Here `event` is an
application-supplied Colibri event returned by its event APIs, and `address` is
the sender to filter:

```ts
const definition = token.events.Transfer;
const filter = definition.toEventFilter({ from: address });
const transfer = definition.fromEvent(event);
console.log(filter, transfer.fields.amount, transfer.ledger, transfer.txHash);
```

Unindexed payload fields cannot be used as topic filters. Event names, fields,
indexed flags and documentation come from the spec; the generator does not infer
them from historical transactions.

`tryFromEvent` returns undefined on a nonmatch. Registry `parse` throws if more
than one declaration matches; select the name and occurrence explicitly.
`events.bindings` records aliases for collisions with registry properties.
Contracts may emit events even when the spec contains no event declarations.

Core also supports dynamic event extraction without generating files. See
[spec-aware events](../../core/contract/events.md).

[Package overview](../contract-bindings.md)
