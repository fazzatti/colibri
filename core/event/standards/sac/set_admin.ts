/**
 * SAC (Stellar Asset Contract) Set Admin Event
 *
 * CAP-0046-06: Emitted when the admin is changed.
 *
 * Topics: [symbol("set_admin"), admin: Address, sep0011_asset: String]
 * Data: new_admin: Address
 *
 * @module
 */

import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";
import { isStellarAssetCanonicalString } from "@/asset/sep11/index.ts";
import type { StellarAssetCanonicalString } from "@/asset/sep11/types.ts";

/**
 * SAC Set Admin Event Schema
 *
 * Topics: [symbol("set_admin"), admin: Address, asset: String]
 * Value: new_admin: Address
 */
export const SetAdminEventSchema = {
  name: "set_admin",
  topics: [
    { name: "admin", type: "address" },
    { name: "asset", type: "string" },
  ],
  value: { name: "newAdmin", type: "address" },
} as const satisfies EventSchema;

/**
 * SAC Set Admin Event
 *
 * Emitted when the token admin is changed.
 *
 * Topics: [symbol("set_admin"), admin: Address, sep0011_asset: String]
 * Data: new_admin: Address
 *
 * @example
 * // Check if an event is a SAC SetAdminEvent
 * if (SetAdminEvent.is(event)) {
 *   const setAdmin = SetAdminEvent.fromEvent(event);
 *   console.log("Old admin:", setAdmin.admin);
 *   console.log("New admin:", setAdmin.newAdmin);
 *   console.log("Asset:", setAdmin.asset);
 * }
 */
export class SetAdminEvent extends EventTemplate<typeof SetAdminEventSchema> {
  static override schema = SetAdminEventSchema;

  /** The current admin address that authorized the change. */
  get admin(): string {
    return this.get("admin");
  }

  /** The SEP-11 asset string (e.g., "USDC:G..." or "native"). */
  get asset(): StellarAssetCanonicalString {
    const val = this.get("asset");
    if (!isStellarAssetCanonicalString(val)) {
      throw new Error(`Invalid SEP-11 asset format: ${val}`);
    }
    return val;
  }

  /** The new admin address. */
  get newAdmin(): string {
    return this.get("newAdmin");
  }

  /**
   * Whether the `admin` address is a valid Stellar account (G...).
   */
  isAdminAccount(): boolean {
    return StrKey.isValidEd25519PublicKey(this.admin);
  }

  /**
   * Whether the `admin` address is a valid contract (C...).
   */
  isAdminContract(): boolean {
    return StrKey.isValidContractId(this.admin);
  }

  /**
   * Whether the `newAdmin` address is a valid Stellar account (G...).
   */
  isNewAdminAccount(): boolean {
    return StrKey.isValidEd25519PublicKey(this.newAdmin);
  }

  /**
   * Whether the `newAdmin` address is a valid contract (C...).
   */
  isNewAdminContract(): boolean {
    return StrKey.isValidContractId(this.newAdmin);
  }
}
