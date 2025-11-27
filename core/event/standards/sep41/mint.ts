import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";
import type { Event } from "@/event/event.ts";
import { isEventMuxedData } from "@/event/standards/cap67/index.ts";

/**
 * SEP-41 Mint Event Schema (simple variant)
 *
 * Topics: [symbol("mint"), to: Address]
 * Value: i128 (amount)
 */
export const MintEventSchema = {
  name: "mint",
  topics: [{ name: "to", type: "address" }],
  value: { name: "amount", type: "i128" },
} as const satisfies EventSchema;

/**
 * SEP-41 Mint Event
 *
 * Emitted when tokens are minted.
 *
 * Topics: [symbol("mint"), to: Address]
 * Data: i128 OR map { amount: i128, to_muxed_id?: u64 | String | BytesN<32> }
 *
 * @example
 * // Check if an event is a MintEvent
 * if (MintEvent.is(event)) {
 *   const mint = MintEvent.fromEvent(event);
 *   console.log(mint.to, mint.amount);
 *
 *   // Check for muxed address
 *   if (mint.hasMuxedId()) {
 *     console.log("Muxed ID:", mint.toMuxedId);
 *   }
 * }
 *
 * // Create a topic filter
 * const filter = MintEvent.toTopicFilter({ to: "G..." });
 */
export class MintEvent extends EventTemplate<typeof MintEventSchema> {
  static override schema = MintEventSchema;

  /**
   * Checks if an event matches the SEP-41 MintEvent schema.
   * Overrides base implementation to accept both i128 and muxed map value formats.
   */
  static override is(event: Event): boolean {
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

    // Check topic field types (to)
    if (typeof topics[1] !== "string") return false; // to address

    // Check value type: accept either i128 (bigint) or muxed map format
    const value = event.value;
    if (typeof value === "bigint") {
      return true; // Simple i128 format
    }
    if (isEventMuxedData(value)) {
      return true; // Muxed map format (CAP-0067)
    }

    return false;
  }

  /** The recipient address that received the minted tokens. */
  get to(): string {
    return this.get("to");
  }

  /**
   * The amount of tokens minted.
   * Handles both simple (i128) and muxed (map) data formats.
   */
  get amount(): bigint {
    const val = this.value;
    if (typeof val === "bigint") {
      return val;
    }
    if (isEventMuxedData(val)) {
      return val.amount as bigint;
    }
    throw new Error("Invalid mint event data format");
  }

  /**
   * The muxed ID if present (for muxed addresses).
   * Can be u64 (bigint), String, or BytesN<32> (Uint8Array).
   */
  get toMuxedId(): bigint | string | Uint8Array | undefined {
    const val = this.value;
    if (isEventMuxedData(val) && "to_muxed_id" in val) {
      return val.to_muxed_id as bigint | string | Uint8Array | undefined;
    }
    return undefined;
  }

  /**
   * Whether this mint event has a muxed ID.
   */
  hasMuxedId(): boolean {
    return this.toMuxedId !== undefined;
  }

  /**
   * Whether the `to` address is a valid Stellar account (G...).
   */
  isToAccount(): boolean {
    return StrKey.isValidEd25519PublicKey(this.to);
  }

  /**
   * Whether the `to` address is a valid contract (C...).
   */
  isToContract(): boolean {
    return StrKey.isValidContractId(this.to);
  }
}
