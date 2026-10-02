# Load event declarations from a contract spec

Core can extract SEP-48 event declarations from an SDK Spec or Wasm bytes. The
registry creates reusable `ContractEventDefinition` objects for decoding and
filtering, and powers the
[bindings generator](../../packages/contract-bindings.md).

After installing [`@colibri/core`](../overview.md), this complete example reads
a local, application-supplied Wasm file and prints filters for its declared
events:

<!-- deno-check -->

```ts
import { extractContractEventsFromWasm } from "@colibri/core";

const wasm = await Deno.readFile("./contract.wasm");
const events = extractContractEventsFromWasm(wasm);
for (const definition of events.list()) {
  console.log(definition.name, definition.toEventFilter().toRawEventFilter());
}
```

Alternatively, call `extractContractEventsFromSpec(spec)` with a loaded SDK
spec. An optional `{ contractId }` scopes full filters and decoding to that
emitter. No contract binding means filters can match any emitting contract.

For an existing [`Contract`](../contract.md), `contract.events` uses its loaded
spec and current contract ID without network access. It throws when no spec is
loaded. Call `await contract.loadContractEventsFromWasm()` to load from existing
local Wasm or resolve code through the configured network source first. An
explicit subsequent spec load refreshes the registry; keep using the registry
for the ABI you intend to decode. Registry construction captures its own copy of
the spec.

`events.get(name, occurrence)` selects an original ABI name and zero-based
occurrence. `events.bindings` records deterministic safe property aliases.
[Generated clients](../../packages/contract-bindings/generated-client.md) expose
those properties with exact TypeScript field types; dynamic callers use the
registry lookup API.

- `definition.fromEvent(event)` validates a contract occurrence and returns a
  `ContractEvent` with native `fields` and `get(name)`. Ledger, transaction,
  emitter, and raw XDR remain available.
- `definition.tryFromEvent(event)` returns undefined when it does not match;
  `is(event)` returns a boolean.
- `definition.toTopicFilter(values)` encodes indexed fields. Omitted fields are
  wildcards. Unknown/non-indexed fields and invalid values are typed errors.
- `definition.toEventFilter(values)` also includes event type and any bound
  contract ID. Topicless declarations use the RPC `**` wildcard; decoding still
  validates the exact declared topic count.
- `events.parse(event)` accepts a unique match, returns undefined for no match,
  and throws a typed ambiguity error for multiple matches.

Payloads support single-value, vector, and map formats. Wrong topics, missing
required fields, invalid nested shapes and incompatible wire types fail with
[typed event errors](../../reference/errors/core-contract-events.md). Values
follow the SDK's native codec representations.

## Sparse map data and ambiguity

Map data uses Symbol field names. Missing void-compatible fields, including
`Option<T>`, normalize to `null`; unknown fields are ignored while raw
`scvalValue` remains available. Duplicate/unordered map keys and wrong key arms
are rejected. Nested structs use the same
[named-record evolution](values.md#named-record-evolution) rules. Single-value
and vector payload arity remains exact.

The optional registry settings `dataFields: "strict"` and
`structFields: "strict"` require exact map and nested-struct field sets,
respectively. Sparse records are accepted by default, including handlers from
[generated bindings](../../packages/contract-bindings/errors-and-events.md).

SEP-57 `Transfer` and `MuxedTransfer` share a topic prefix. With tolerant map
evolution, both can match an amount-only event, and even extra fields need not
make the match unique. `events.parse()` reports `AMBIGUOUS_EVENT`; select
`events.get("Transfer")` or `events.get("MuxedTransfer")` when the application
knows the declaration. Strict map diagnostics can distinguish dense field sets,
but cannot recover information omitted on the wire. The SEP-57 muxed field is
`Option<u64>`; it does not accept SEP-41's historical String/Bytes memo forms.

## Topic counts and remote queries

Occurrences may contain more than four topics. ABI decoding checks the complete
declared topic count; the ABI permits at most two fixed prefix Symbols, with
additional indexed fields. RPC [topic filters](../../events/event-filter.md)
permit at most four constraints plus a trailing `**`. A declaration requiring
more constraints throws `INVALID_FILTER` when asked for an automatic filter.
Choose a broader prefix query explicitly and decode the complete occurrence
locally; Colibri does not silently drop query constraints.

Indexed filters apply the same field validation as decoding. Soroban
[`MuxedAddress`](../address.md) fields accept regular account (G), contract (C),
and multiplexed account (M) addresses. Ordinary `Address` fields accept G and C
addresses and reject M addresses in both filters and decoded occurrences.

No event declarations does not imply that the contract never emits events.
Historical events require the ABI that emitted them; refreshing a registry does
not migrate old payloads or track contract upgrades automatically.

See [event APIs](https://jsr.io/@colibri/core/doc/~/ContractEventRegistry) and
[definition APIs](https://jsr.io/@colibri/core/doc/~/ContractEventDefinition).
