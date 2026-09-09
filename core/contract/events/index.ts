/** Spec-aware event definitions shared by dynamic contracts and generated clients. */
import { Spec } from "stellar-sdk/contract";
import type { BinaryData } from "@/common/types/index.ts";
import type { Event } from "@/event/event.ts";
import { extractContractSpec } from "@/contract/interface/extract-contract-spec.ts";
import {
  type ContractEvent,
  ContractEventDefinition,
} from "@/contract/events/definition.ts";
import type {
  ContractEventBinding,
  ContractEventOptions,
} from "@/contract/events/types.ts";
import * as E from "@/contract/events/error.ts";
export * from "@/contract/events/definition.ts";
export * from "@/contract/events/types.ts";
export { CONTRACT_EVENT_ERRORS } from "@/contract/events/error.ts";

/** Maps ABI event names to safe, deterministic registry properties. */
export function contractEventBindings(spec: Spec): ContractEventBinding[] {
  const used = new Set([
    "get",
    "list",
    "parse",
    "bindings",
    "contractId",
    "constructor",
    "then",
    "toJSON",
    "__proto__",
    "prototype",
    ...Object.getOwnPropertyNames(Object.prototype),
  ]);
  const counts = new Map<string, number>();
  return spec.events().map((event) => {
    const name = event.name.toString();
    const occurrence = counts.get(name) ?? 0;
    counts.set(name, occurrence + 1);
    const base =
      name.replace(/[^A-Za-z0-9_$]/g, "_").replace(/^[0-9]/, (character) =>
        `_${character}`) || "event";
    let key = base;
    let suffix = 2;
    while (used.has(key)) {
      key = `${base}_${suffix++}`;
    }
    used.add(key);
    return { name, occurrence, key };
  });
}

/** Registry of declared events. Missing declarations do not imply no events are emitted. */
export class ContractEventRegistry {
  /** ABI names, occurrences and generated property aliases. */
  readonly bindings: readonly ContractEventBinding[];
  /** Emitting contract restriction, if supplied. */
  readonly contractId: ContractEventOptions["contractId"];
  readonly #definitions: readonly ContractEventDefinition[];
  /** Creates a registry. Event declarations are captured from the supplied spec. */
  constructor(spec: Spec, options: ContractEventOptions = {}) {
    spec = new Spec(spec.entries.map((entry) => entry.toXdr("base64")));
    options = { ...options };
    this.contractId = options.contractId;
    this.bindings = Object.freeze(
      contractEventBindings(spec).map((binding) => Object.freeze(binding)),
    );
    this.#definitions = Object.freeze(
      spec.events().map((event, index) =>
        new ContractEventDefinition(
          spec,
          event,
          this.bindings[index].occurrence,
          options,
        )
      ),
    );
    this.bindings.forEach((binding, index) =>
      Object.defineProperty(this, binding.key, {
        value: this.#definitions[index],
        enumerable: true,
      })
    );
  }
  /** Looks up an original ABI name, with an explicit occurrence for duplicates. */
  get(name: string, occurrence = 0): ContractEventDefinition {
    const index = this.bindings.findIndex((binding) =>
      binding.name === name && binding.occurrence === occurrence
    );
    if (index < 0) throw new E.UNKNOWN_EVENT(name, occurrence);
    return this.#definitions[index];
  }
  /** Returns all definitions in spec order. */
  list(): readonly ContractEventDefinition[] {
    return this.#definitions;
  }
  /** Decodes a uniquely matching event; returns undefined when none match. */
  parse(event: Event): ContractEvent | undefined {
    const matches = this.#definitions.flatMap((definition) => {
      const parsed = definition.tryFromEvent(event);
      return parsed ? [{ definition, parsed }] : [];
    });
    if (matches.length > 1) {
      throw new E.AMBIGUOUS_EVENT(
        matches.map((match) => match.definition.name),
      );
    }
    return matches[0]?.parsed;
  }
}
/** Extracts a registry from an existing spec without network or filesystem access. */
export function extractContractEventsFromSpec(
  spec: Spec,
  options: ContractEventOptions = {},
): ContractEventRegistry {
  return new ContractEventRegistry(spec, options);
}
/** Extracts the spec and its event definitions from local Wasm bytes. */
export function extractContractEventsFromWasm(
  wasm: BinaryData,
  options: ContractEventOptions = {},
): ContractEventRegistry {
  return extractContractEventsFromSpec(extractContractSpec(wasm), options);
}
