import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";

/**
 * SEP-41 Approve Event Schema
 *
 * Topics: [symbol("approve"), from: Address, spender: Address]
 * Value: vec [amount: i128, live_until_ledger: u32]
 */
export const ApproveEventSchema = {
  name: "approve",
  topics: [
    { name: "from", type: "address" },
    { name: "spender", type: "address" },
  ],
  value: { name: "data", type: "vec" },
} as const satisfies EventSchema;

/**
 * SEP-41 Approve Event
 *
 * Emitted when the allowance is set for a spender to transfer tokens
 * from an owner's balance.
 *
 * Topics: [symbol("approve"), from: Address, spender: Address]
 * Data: [amount: i128, live_until_ledger: u32]
 *
 * @example
 * // Check if an event is an ApproveEvent
 * if (ApproveEvent.is(event)) {
 *   const approve = ApproveEvent.fromEvent(event);
 *   console.log(approve.from, approve.spender, approve.amount);
 *   console.log("Expires at ledger:", approve.liveUntilLedger);
 * }
 *
 * // Create a topic filter for approvals from a specific address
 * const filter = ApproveEvent.toTopicFilter({ from: "G..." });
 */
export class ApproveEvent extends EventTemplate<typeof ApproveEventSchema> {
  static override schema = ApproveEventSchema;

  /** The address holding the balance of tokens to be drawn from. */
  get from(): string {
    return this.get("from");
  }

  /** The address authorized to spend the tokens. */
  get spender(): string {
    return this.get("spender");
  }

  /**
   * The amount of tokens approved for spending.
   */
  get amount(): bigint {
    const data = this.value as unknown[];
    return data[0] as bigint;
  }

  /**
   * The ledger number when this allowance expires.
   */
  get liveUntilLedger(): number {
    const data = this.value as unknown[];
    return data[1] as number;
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
   * Whether the `spender` address is a valid Stellar account (G...).
   */
  isSpenderAccount(): boolean {
    return StrKey.isValidEd25519PublicKey(this.spender);
  }

  /**
   * Whether the `spender` address is a valid contract (C...).
   */
  isSpenderContract(): boolean {
    return StrKey.isValidContractId(this.spender);
  }
}
