/**
 * SAC (Stellar Asset Contract) Approve Event
 *
 * CAP-0046-06: Emitted when an allowance is set for a spender.
 *
 * Topics: [symbol("approve"), from: Address, spender: Address, sep0011_asset: String]
 * Data: [amount: i128, live_until_ledger: u32]
 *
 * @module
 */

import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";
import { isStellarAssetCanonicalString } from "@/asset/sep11/index.ts";
import type { StellarAssetCanonicalString } from "@/asset/sep11/types.ts";

/**
 * SAC Approve Event Schema
 *
 * Topics: [symbol("approve"), from: Address, spender: Address, asset: String]
 * Value: vec [amount: i128, live_until_ledger: u32]
 */
export const ApproveEventSchema = {
  name: "approve",
  topics: [
    { name: "from", type: "address" },
    { name: "spender", type: "address" },
    { name: "asset", type: "string" },
  ],
  value: { name: "data", type: "vec" },
} as const satisfies EventSchema;

/**
 * SAC Approve Event
 *
 * Emitted when the allowance is set for a spender to transfer tokens
 * from an owner's balance.
 *
 * Topics: [symbol("approve"), from: Address, spender: Address, sep0011_asset: String]
 * Data: [amount: i128, live_until_ledger: u32]
 *
 * @example
 * // Check if an event is a SAC ApproveEvent
 * if (ApproveEvent.is(event)) {
 *   const approve = ApproveEvent.fromEvent(event);
 *   console.log(approve.from, approve.spender, approve.amount);
 *   console.log("Asset:", approve.asset);
 *   console.log("Expires at ledger:", approve.liveUntilLedger);
 * }
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

  /** The SEP-11 asset string (e.g., "USDC:G..." or "native"). */
  get asset(): StellarAssetCanonicalString {
    const val = this.get("asset");
    if (!isStellarAssetCanonicalString(val)) {
      throw new Error(`Invalid SEP-11 asset format: ${val}`);
    }
    return val;
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
