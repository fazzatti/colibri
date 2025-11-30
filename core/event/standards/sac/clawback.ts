/**
 * SAC (Stellar Asset Contract) Clawback Event
 *
 * CAP-0067: Emitted when tokens are clawed back.
 *
 * Topics: [symbol("clawback"), from: Address, sep0011_asset: String]
 * Data: amount: i128
 *
 * @module
 */

import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";
import { isStellarAssetCanonicalString } from "@/asset/sep11/index.ts";
import type { StellarAssetCanonicalString } from "@/asset/sep11/types.ts";

/**
 * SAC Clawback Event Schema
 *
 * Topics: [symbol("clawback"), from: Address, asset: String]
 * Value: i128 (amount)
 *
 * Note: CAP-0067 removed the admin from the topics.
 */
export const ClawbackEventSchema = {
  name: "clawback",
  topics: [
    { name: "from", type: "address" },
    { name: "asset", type: "string" },
  ],
  value: { name: "amount", type: "i128" },
} as const satisfies EventSchema;

/**
 * SAC Clawback Event
 *
 * Emitted when tokens are clawed back from an address.
 *
 * Topics: [symbol("clawback"), from: Address, sep0011_asset: String]
 * Data: amount: i128
 *
 * Note: CAP-0067 removed the admin from the topics.
 *
 * @example
 * // Check if an event is a SAC ClawbackEvent
 * if (ClawbackEvent.is(event)) {
 *   const clawback = ClawbackEvent.fromEvent(event);
 *   console.log(clawback.from, clawback.amount);
 *   console.log("Asset:", clawback.asset);
 * }
 */
export class ClawbackEvent extends EventTemplate<typeof ClawbackEventSchema> {
  static override schema = ClawbackEventSchema;

  /** The address from which tokens were clawed back. */
  get from(): string {
    return this.get("from");
  }

  /** The SEP-11 asset string (e.g., "USDC:G..." or "native"). */
  get asset(): StellarAssetCanonicalString {
    const val = this.get("asset");
    if (!isStellarAssetCanonicalString(val)) {
      throw new Error(`Invalid SEP-11 asset format: ${val}`);
    }
    return val;
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
