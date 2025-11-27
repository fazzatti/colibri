import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";

/**
 * SEP-41 Burn Event Schema
 *
 * Topics: [symbol("burn"), from: Address]
 * Value: i128 (amount)
 */
export const BurnEventSchema = {
  name: "burn",
  topics: [{ name: "from", type: "address" }],
  value: { name: "amount", type: "i128" },
} as const satisfies EventSchema;

/**
 * SEP-41 Burn Event
 *
 * Emitted when an amount is burned from one address.
 *
 * Topics: [symbol("burn"), from: Address]
 * Data: i128 (amount)
 *
 * @example
 * // Check if an event is a BurnEvent
 * if (BurnEvent.is(event)) {
 *   const burn = BurnEvent.fromEvent(event);
 *   console.log(burn.from, burn.amount);
 * }
 *
 * // Create a topic filter for burns from a specific address
 * const filter = BurnEvent.toTopicFilter({ from: "G..." });
 */
export class BurnEvent extends EventTemplate<typeof BurnEventSchema> {
  static override schema = BurnEventSchema;

  /** The address from which tokens were burned. */
  get from(): string {
    return this.get("from");
  }

  /** The amount of tokens burned. */
  get amount(): bigint {
    return this.get("amount");
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
}
