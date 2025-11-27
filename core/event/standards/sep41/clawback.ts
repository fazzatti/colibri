import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";

/**
 * SEP-41 Clawback Event Schema
 *
 * Topics: [symbol("clawback"), from: Address]
 * Value: i128 (amount)
 */
export const ClawbackEventSchema = {
  name: "clawback",
  topics: [{ name: "from", type: "address" }],
  value: { name: "amount", type: "i128" },
} as const satisfies EventSchema;

/**
 * SEP-41 Clawback Event
 *
 * Emitted when an amount of the token is clawed back from an address.
 *
 * Topics: [symbol("clawback"), from: Address]
 * Data: i128 (amount)
 *
 * @example
 * // Check if an event is a ClawbackEvent
 * if (ClawbackEvent.is(event)) {
 *   const clawback = ClawbackEvent.fromEvent(event);
 *   console.log(clawback.from, clawback.amount);
 * }
 *
 * // Create a topic filter for clawbacks from a specific address
 * const filter = ClawbackEvent.toTopicFilter({ from: "G..." });
 */
export class ClawbackEvent extends EventTemplate<typeof ClawbackEventSchema> {
  static override schema = ClawbackEventSchema;

  /** The address from which tokens were clawed back. */
  get from(): string {
    return this.get("from");
  }

  /** The amount of tokens clawed back. */
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
