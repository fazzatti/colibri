# Load event declarations from a contract spec

Core 1.1 can extract SEP-48 event declarations from an SDK Spec or Wasm bytes.
The registry creates reusable `ContractEventDefinition` objects for decoding and
filtering, and powers the
[bindings generator](../../packages/contract-bindings.md).

After installing `@colibri/core`, this complete example reads a local,
application-supplied Wasm file and prints filters for its declared events:

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

For an existing `Contract`, `contract.events` uses its loaded spec and current
contract ID without network access. It throws when no spec is loaded. Call
`await contract.loadContractEventsFromWasm()` to load from existing local Wasm
or resolve code through the configured network source first. An explicit
subsequent spec load refreshes the registry; keep using the registry for the ABI
you intend to decode. Registry construction captures its own copy of the spec.

`events.get(name, occurrence)` selects an original ABI name and zero-based
occurrence. `events.bindings` records deterministic safe property aliases.
Generated clients expose those properties with exact TypeScript field types;
dynamic callers use the registry lookup API.

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

Payloads support single-value, vector, and map formats. Strict validation
rejects extra or missing fields, wrong topics, invalid nested shapes, and
incompatible native values before the SDK decoder runs. Values follow the SDK's
native codec representations. Types the SDK cannot decode produce a typed
decoding failure.

Indexed filters apply the same field validation as decoding. Soroban
`MuxedAddress` fields accept regular account (G), contract (C), and multiplexed
account (M) addresses. Ordinary `Address` fields accept G and C addresses and
reject M addresses in both filters and decoded occurrences.

No event declarations does not imply that the contract never emits events.
Historical events require the ABI that emitted them; refreshing a registry does
not migrate old payloads or track contract upgrades automatically.

See [event APIs](https://jsr.io/@colibri/core/doc/~/ContractEventRegistry) and
[definition APIs](https://jsr.io/@colibri/core/doc/~/ContractEventDefinition).
