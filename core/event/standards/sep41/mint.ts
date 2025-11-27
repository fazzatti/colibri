import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";
import type { ScValParsed, ScValRecord } from "@/common/scval/types.ts";
import { isScValRecord } from "@/common/scval/index.ts";

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
 * Muxed data structure for mint events with muxed addresses.
 */
export interface MintMuxedData {
  amount: bigint;
  to_muxed_id?: bigint | string | Uint8Array;
}

/**
 * Type guard to check if value is a muxed mint data structure.
 */
export function isMintMuxedData(value: ScValParsed): value is ScValRecord {
  if (!isScValRecord(value)) return false;
  return "amount" in value && typeof value.amount === "bigint";
}

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
    if (isMintMuxedData(val)) {
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
    if (isMintMuxedData(val) && "to_muxed_id" in val) {
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
