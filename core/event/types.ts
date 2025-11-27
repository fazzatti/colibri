import type { xdr } from "stellar-sdk";
import type { EventId } from "@/event/event-id/index.ts";
import type { ContractId } from "@/strkeys/types.ts";
import type { ScValParsed } from "@/common/scval/types.ts";

export interface IEvent {
  id: EventId;
  type: EventType;
  ledger: number;
  ledgerClosedAt: string;
  transactionIndex: number;
  operationIndex: number;
  inSuccessfulContractCall: boolean;
  txHash: string;
  contractId?: ContractId | undefined;
  scvalTopics: xdr.ScVal[];
  scvalValue: xdr.ScVal;

  topics: ScValParsed[];
  value: ScValParsed;
}

export enum EventType {
  Contract = "contract",
  System = "system",
}

export type EventHandler = (event: IEvent) => Promise<void> | void;

/**
 * Schema types for defining event structures.
 *
 * These types allow defining event shapes that can be used to:
 * - Validate events match expected structure
 * - Generate topic filters
 * - Provide typed accessors for event fields
 */

/**
 * Supported field types in event schemas.
 * Maps to ScVal types and their TypeScript equivalents.
 */
export type SchemaFieldType =
  | "address"
  | "bool"
  | "bytes"
  | "i32"
  | "i64"
  | "i128"
  | "i256"
  | "string"
  | "symbol"
  | "u32"
  | "u64"
  | "u128"
  | "u256"
  | "timepoint"
  | "duration"
  | "vec"
  | "map";

/**
 * A field definition in an event schema.
 */
export interface SchemaField {
  readonly name: string;
  readonly type: SchemaFieldType;
}

/**
 * Event schema definition.
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
 */
export interface EventSchema {
  /** The event name (first topic, must be a symbol) */
  readonly name: string;
  /** Topic fields after the event name (max 3) */
  readonly topics: readonly SchemaField[];
  /** The event value/data field */
  readonly value: SchemaField;
}

/**
 * Maps schema field types to their TypeScript equivalents.
 */
export type FieldTypeToTs<T extends SchemaFieldType> = T extends "address"
  ? string
  : T extends "bool"
  ? boolean
  : T extends "bytes"
  ? Uint8Array
  : T extends "i32" | "u32"
  ? number
  : T extends "i64" | "u64" | "i128" | "u128" | "i256" | "u256"
  ? bigint
  : T extends "timepoint" | "duration"
  ? bigint
  : T extends "string" | "symbol"
  ? string
  : T extends "vec"
  ? unknown[]
  : T extends "map"
  ? Record<string, unknown> | Map<unknown, unknown>
  : unknown;

/**
 * Extracts field names from schema topics.
 */
export type TopicFieldNames<S extends EventSchema> =
  S["topics"][number]["name"];

/**
 * Extracts all field names from schema (topics + value).
 */
export type AllFieldNames<S extends EventSchema> =
  | TopicFieldNames<S>
  | S["value"]["name"];

/**
 * Gets the field type for a given field name in the schema.
 */
export type FieldTypeFor<
  S extends EventSchema,
  N extends AllFieldNames<S>
> = N extends S["value"]["name"]
  ? FieldTypeToTs<S["value"]["type"]>
  : N extends S["topics"][number]["name"]
  ? FieldTypeToTs<Extract<S["topics"][number], { name: N }>["type"]>
  : never;

/**
 * Creates a record type from schema with field names as keys
 * and their TypeScript types as values.
 */
export type FieldsFromSchema<S extends EventSchema> = {
  [K in AllFieldNames<S>]: FieldTypeFor<S, K>;
};

/**
 * Partial fields for topic filter (all optional).
 */
export type TopicFilterArgs<S extends EventSchema> = {
  [K in TopicFieldNames<S>]?: FieldTypeFor<S, K>;
};
