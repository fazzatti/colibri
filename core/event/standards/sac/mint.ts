/**
 * SAC (Stellar Asset Contract) Mint Event
 *
 * CAP-0067: Emitted when tokens are minted.
 *
 * Topics: [symbol("mint"), to: Address, sep0011_asset: String]
 * Data: amount: i128
 *
 * @module
 */

import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";
import type { Event } from "@/event/event.ts";
import { isEventMuxedData } from "@/event/standards/cap67/index.ts";
import { isSEP11Asset } from "@/asset/sep11/index.ts";
import type { SEP11Asset } from "@/asset/sep11/types.ts";

/**
 * SAC Mint Event Schema
 *
 * Topics: [symbol("mint"), to: Address, asset: String]
 * Value: i128 (amount)
 *
 * Note: CAP-0067 removed the admin from the topics.
 */
export const MintEventSchema = {
  name: "mint",
  topics: [
    { name: "to", type: "address" },
    { name: "asset", type: "string" },
  ],
  value: { name: "amount", type: "i128" },
} as const satisfies EventSchema;

/**
 * SAC Mint Event
 *
 * Emitted when tokens are minted to an address.
 *
 * Topics: [symbol("mint"), to: Address, sep0011_asset: String]
 * Data: i128 OR map { amount: i128, to_muxed_id?: u64 | String | BytesN<32> }
 *
 * Note: CAP-0067 removed the admin from the topics.
 *
 * @example
 * // Check if an event is a SAC MintEvent
 * if (MintEvent.is(event)) {
 *   const mint = MintEvent.fromEvent(event);
 *   console.log(mint.to, mint.amount);
 *   console.log("Asset:", mint.asset);
 * }
 */
export class MintEvent extends EventTemplate<typeof MintEventSchema> {
  static override schema = MintEventSchema;

  /**
   * Checks if an event matches the SAC MintEvent schema.
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

    // Check topic field types (to, asset)
    if (typeof topics[1] !== "string") return false; // to address
    if (typeof topics[2] !== "string") return false; // asset string

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

  /** The address that received the minted tokens. */
  get to(): string {
    return this.get("to");
  }

  /** The SEP-11 asset string (e.g., "USDC:G..." or "native"). */
  get asset(): SEP11Asset {
    const val = this.get("asset");
    if (!isSEP11Asset(val)) {
      throw new Error(`Invalid SEP-11 asset format: ${val}`);
    }
    return val;
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
