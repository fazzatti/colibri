import { Buffer } from "buffer";
import { Address, xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { Event } from "@/event/event.ts";
import type {
  EventSchema,
  SchemaFieldType,
  AllFieldNames,
  FieldTypeFor,
  TopicFilterArgs,
  TopicFieldNames,
} from "@/event/types.ts";
import type { ScValParsed } from "@/common/scval/types.ts";
import type { TopicFilter, Segment } from "@/event/event-filter/types.ts";

/**
 * Converts a TypeScript value to ScVal based on schema field type.
 */
function valueToScVal(value: unknown, type: SchemaFieldType): xdr.ScVal {
  switch (type) {
    case "address":
      return new Address(value as string).toScVal();
    case "bool":
      return xdr.ScVal.scvBool(value as boolean);
    case "symbol":
      return xdr.ScVal.scvSymbol(value as string);
    case "string":
      return xdr.ScVal.scvString(value as string);
    case "u32":
      return xdr.ScVal.scvU32(value as number);
    case "i32":
      return xdr.ScVal.scvI32(value as number);
    case "bytes":
      return xdr.ScVal.scvBytes(Buffer.from(value as Uint8Array));
    // For larger integers, we'd need nativeToScVal - keeping simple for now
    default:
      throw new Error(`Cannot convert value to ScVal for type: ${type}`);
  }
}

/**
 * Validates a parsed value matches the expected schema field type.
 */
function validateFieldType(value: ScValParsed, type: SchemaFieldType): boolean {
  switch (type) {
    case "address":
    case "string":
    case "symbol":
      return typeof value === "string";
    case "bool":
      return typeof value === "boolean";
    case "u32":
    case "i32":
      return typeof value === "number";
    case "u64":
    case "i64":
    case "u128":
    case "i128":
    case "u256":
    case "i256":
    case "timepoint":
    case "duration":
      return typeof value === "bigint";
    case "bytes":
      return value instanceof Uint8Array;
    case "vec":
      return Array.isArray(value);
    case "map":
      return (
        value instanceof Map ||
        (typeof value === "object" && value !== null && !Array.isArray(value))
      );
    default:
      return true;
  }
}

/**
 * Base class for schema-driven events.
 *
 * Extend this class and provide a schema to get automatic:
 * - Event validation with `is()`
 * - Event conversion with `fromEvent()` / `tryFromEvent()`
 * - Topic filter generation with `toTopicFilter()`
 * - Typed field access with `get()`
 *
 * @example
 * const MintSchema = {
 *   name: "mint",
 *   topics: [
 *     { name: "admin", type: "address" },
 *     { name: "to", type: "address" },
 *   ],
 *   value: { name: "amount", type: "i128" },
 * } as const satisfies EventSchema;
 *
 * class MintEvent extends EventTemplate<typeof MintSchema> {
 *   static schema = MintSchema;
 * }
 *
 * // Usage:
 * if (MintEvent.is(event)) {
 *   const mint = MintEvent.fromEvent(event);
 *   console.log(mint.get("amount")); // bigint
 * }
 */
export abstract class EventTemplate<S extends EventSchema> extends Event {
  /**
   * The schema for this event type.
   * Must be defined by subclasses.
   */
  static schema: EventSchema;

  /**
   * Gets a typed field value by name.
   *
   * @param field The field name (from topics or value)
   * @returns The parsed value with correct TypeScript type
   */
  get<K extends AllFieldNames<S>>(field: K): FieldTypeFor<S, K> {
    const schema = (this.constructor as typeof EventTemplate).schema as S;

    // Check if it's the value field
    if (field === schema.value.name) {
      return this.value as FieldTypeFor<S, K>;
    }

    // Find in topics
    const topicIndex = schema.topics.findIndex((t) => t.name === field);
    if (topicIndex !== -1) {
      // +1 because topics[0] is the event name
      return this.topics[topicIndex + 1] as FieldTypeFor<S, K>;
    }

    throw new Error(`Unknown field: ${String(field)}`);
  }

  /**
   * Checks if an event matches this event type's schema.
   */
  static is(event: Event): boolean {
    const schema = this.schema;
    const topics = event.topics;

    // Check topic count: name + topic fields
    if (topics.length !== schema.topics.length + 1) {
      return false;
    }

    // Check event name
    if (topics[0] !== schema.name) {
      return false;
    }

    // Check topic field types
    for (let i = 0; i < schema.topics.length; i++) {
      if (!validateFieldType(topics[i + 1], schema.topics[i].type)) {
        return false;
      }
    }

    // Check value type
    if (!validateFieldType(event.value, schema.value.type)) {
      return false;
    }

    return true;
  }

  /**
   * Creates an instance from a base Event.
   * Throws if the event doesn't match the schema.
   */
  static fromEvent<T extends EventTemplate<EventSchema>>(
    this: { schema: EventSchema; is(event: Event): boolean; prototype: T },
    event: Event
  ): T {
    if (!this.is(event)) {
      const schema = this.schema;
      throw new Error(
        `Event does not match ${schema.name} schema. ` +
          `Expected ${schema.topics.length + 1} topics with name "${
            schema.name
          }".`
      );
    }

    // Copy all properties from the event and set the prototype
    const instance = Object.assign(Object.create(this.prototype), event);
    return instance as T;
  }

  /**
   * Tries to create an instance from a base Event.
   * Returns undefined if the event doesn't match the schema.
   */
  static tryFromEvent<T extends EventTemplate<EventSchema>>(
    this: { schema: EventSchema; is(event: Event): boolean; prototype: T },
    event: Event
  ): T | undefined {
    if (!this.is(event)) {
      return undefined;
    }

    // Copy all properties from the event and set the prototype
    const instance = Object.assign(Object.create(this.prototype), event);
    return instance as T;
  }

  /**
   * Creates an instance directly from an RPC EventResponse.
   * Throws if the event doesn't match the schema.
   *
   * @example
   * const events = await server.getEvents({ ... });
   * for (const response of events.events) {
   *   if (MintEvent.is(Event.fromEventResponse(response))) {
   *     const mint = MintEvent.fromEventResponse(response);
   *     console.log(mint.to, mint.amount);
   *   }
   * }
   */
  static override fromEventResponse<T extends EventTemplate<EventSchema>>(
    this: { schema: EventSchema; is(event: Event): boolean; prototype: T },
    response: Api.EventResponse
  ): T {
    const event = Event.fromEventResponse(response);
    if (!this.is(event)) {
      const schema = this.schema;
      throw new Error(
        `Event does not match ${schema.name} schema. ` +
          `Expected ${schema.topics.length + 1} topics with name "${
            schema.name
          }".`
      );
    }

    // Copy all properties from the event and set the prototype
    const instance = Object.assign(Object.create(this.prototype), event);
    return instance as T;
  }

  /**
   * Tries to create an instance directly from an RPC EventResponse.
   * Returns undefined if the event doesn't match the schema.
   *
   * @example
   * const events = await server.getEvents({ ... });
   * for (const response of events.events) {
   *   const mint = MintEvent.tryFromEventResponse(response);
   *   if (mint) {
   *     console.log(mint.to, mint.amount);
   *   }
   * }
   */
  static tryFromEventResponse<T extends EventTemplate<EventSchema>>(
    this: { schema: EventSchema; is(event: Event): boolean; prototype: T },
    response: Api.EventResponse
  ): T | undefined {
    const event = Event.fromEventResponse(response);
    if (!this.is(event)) {
      return undefined;
    }

    // Copy all properties from the event and set the prototype
    const instance = Object.assign(Object.create(this.prototype), event);
    return instance as T;
  }

  /**
   * Creates a topic filter for querying events of this type.
   * The returned filter can be used directly with EventFilter.
   *
   * @param args Optional filter arguments. Omit a field to match any value (wildcard "*").
   * @returns TopicFilter ready for use with EventFilter
   *
   * @example
   * // Filter for any mint event
   * MintEvent.toTopicFilter({})
   *
   * // Filter for mints to a specific address
   * MintEvent.toTopicFilter({ to: "G..." })
   *
   * // Use with EventFilter
   * const filter = new EventFilter({
   *   topics: [MintEvent.toTopicFilter({ to: "G..." })]
   * });
   */
  static toTopicFilter<S extends EventSchema>(
    this: { schema: S },
    args: TopicFilterArgs<S> = {} as TopicFilterArgs<S>
  ): TopicFilter {
    const schema = this.schema;
    const filter: Segment[] = [xdr.ScVal.scvSymbol(schema.name)];

    for (const topicField of schema.topics) {
      const fieldName = topicField.name as TopicFieldNames<S>;
      const value = (args as Record<string, unknown>)[fieldName];

      if (value !== undefined) {
        filter.push(valueToScVal(value, topicField.type));
      } else {
        filter.push("*"); // wildcard
      }
    }

    return filter as TopicFilter;
  }
}
