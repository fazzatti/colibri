import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import * as E from "@/event/error.ts";
import type { EventSchema } from "@/event/types.ts";
import type { Event } from "@/event/event.ts";
import { isEventMuxedData } from "@/event/standards/cap67/index.ts";

/**
 * SEP-41 Transfer Event Schema (simple variant)
 *
 * Topics: [symbol("transfer"), from: Address, to: Address]
 * Value: i128 (amount)
 */
export const TransferEventSchema = {
  name: "transfer",
  topics: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
  ],
  value: { name: "amount", type: "i128" },
} as const satisfies EventSchema;

/**
 * SEP-41 Transfer Event
 *
 * Emitted when an amount is transferred from one address to another.
 *
 * Topics: [symbol("transfer"), from: Address, to: Address]
 * Data: i128 OR map { amount: i128, to_muxed_id?: u64 | String | BytesN<32> }
 *
 * @example
 * // Check if an event is a TransferEvent
 * if (TransferEvent.is(event)) {
 *   const transfer = TransferEvent.fromEvent(event);
 *   console.log(transfer.from, transfer.to, transfer.amount);
 *
 *   // Check for muxed address
 *   if (transfer.hasMuxedId()) {
 *     console.log("Muxed ID:", transfer.toMuxedId);
 *   }
 * }
 *
 * // Create a topic filter for transfers from a specific address
 * const filter = TransferEvent.toTopicFilter({ from: "G..." });
 */
export class TransferEvent extends EventTemplate<typeof TransferEventSchema> {
  static override schema = TransferEventSchema;

  /**
   * Checks if an event matches the SEP-41 TransferEvent schema.
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

    // Check topic field types (from, to)
    if (typeof topics[1] !== "string") return false; // from address
    if (typeof topics[2] !== "string") return false; // to address

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

  /** The address tokens were transferred from. */
  get from(): string {
    return this.get("from");
  }

  /** The address tokens were transferred to. */
  get to(): string {
    return this.get("to");
  }

  /**
   * The amount of tokens transferred.
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
    throw new E.INVALID_EVENT_DATA_FORMAT("transfer");
  }

  /**
   * The raw CAP-67 `to_muxed_id` field if present.
   *
   * This value is exposed exactly as emitted in the event payload. Per CAP-67,
   * it can represent either a real muxed account ID for a muxed destination, or
   * transaction memo data mapped onto a classic non-muxed destination
   * (`MEMO_ID` -> `bigint`, `MEMO_TEXT` -> `string`, `MEMO_HASH` /
   * `MEMO_RETURN` -> `Uint8Array`).
   *
   * Do not assume that a present value is always a raw muxed-account ID without
   * considering the destination type and transaction context.
   */
  get toMuxedId(): bigint | string | Uint8Array | undefined {
    const val = this.value;
    if (isEventMuxedData(val) && "to_muxed_id" in val) {
      return val.to_muxed_id as bigint | string | Uint8Array | undefined;
    }
    return undefined;
  }

  /**
   * Whether this transfer event includes the CAP-67 `to_muxed_id` field.
   */
  hasMuxedId(): boolean {
    return this.toMuxedId !== undefined;
  }

  /**
   * Whether the `from` address is a valid Stellar account (G...).
   */
  isFromAccount(): boolean {
    return StrKey.isValidEd25519PublicKey(this.from);
  }

  /**
   * Whether the `from` address is a valid contract (C...).
   */
  isFromContract(): boolean {
    return StrKey.isValidContractId(this.from);
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
