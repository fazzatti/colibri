/**
 * SAC (Stellar Asset Contract) Burn Event
 *
 * CAP-0046-06: Emitted when tokens are burned.
 *
 * Topics: [symbol("burn"), from: Address, sep0011_asset: String]
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
 * SAC Burn Event Schema
 *
 * Topics: [symbol("burn"), from: Address, asset: String]
 * Value: i128 (amount)
 */
export const BurnEventSchema = {
  name: "burn",
  topics: [
    { name: "from", type: "address" },
    { name: "asset", type: "string" },
  ],
  value: { name: "amount", type: "i128" },
} as const satisfies EventSchema;

/**
 * SAC Burn Event
 *
 * Emitted when tokens are burned from an address.
 *
 * Topics: [symbol("burn"), from: Address, sep0011_asset: String]
 * Data: amount: i128
 *
 * @example
 * // Check if an event is a SAC BurnEvent
 * if (BurnEvent.is(event)) {
 *   const burn = BurnEvent.fromEvent(event);
 *   console.log(burn.from, burn.amount);
 *   console.log("Asset:", burn.asset);
 * }
 */
export class BurnEvent extends EventTemplate<typeof BurnEventSchema> {
  static override schema = BurnEventSchema;

  /** The address from which tokens were burned. */
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
