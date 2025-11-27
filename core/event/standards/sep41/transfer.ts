import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";
import type { ScValParsed, ScValRecord } from "@/common/scval/types.ts";
import { isScValRecord } from "@/common/scval/index.ts";

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
 * Muxed data structure for transfer events with muxed addresses.
 */
export interface TransferMuxedData {
  amount: bigint;
  to_muxed_id?: bigint | string | Uint8Array;
}

/**
 * Type guard to check if value is a muxed transfer data structure.
 */
export function isTransferMuxedData(value: ScValParsed): value is ScValRecord {
  if (!isScValRecord(value)) return false;
  return "amount" in value && typeof value.amount === "bigint";
}

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
    if (isTransferMuxedData(val)) {
      return val.amount as bigint;
    }
    throw new Error("Invalid transfer event data format");
  }

  /**
   * The muxed ID if present (for muxed addresses).
   * Can be u64 (bigint), String, or BytesN<32> (Uint8Array).
   */
  get toMuxedId(): bigint | string | Uint8Array | undefined {
    const val = this.value;
    if (isTransferMuxedData(val) && "to_muxed_id" in val) {
      return val.to_muxed_id as bigint | string | Uint8Array | undefined;
    }
    return undefined;
  }

  /**
   * Whether this transfer event has a muxed ID.
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
