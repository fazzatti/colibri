/**
 * SAC (Stellar Asset Contract) Set Authorized Event
 *
 * CAP-0067: Emitted when authorization is set for an account.
 *
 * Topics: [symbol("set_authorized"), id: Address, sep0011_asset: String]
 * Data: authorize: bool
 *
 * @module
 */

import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import type { EventSchema } from "@/event/types.ts";
import { isSEP11Asset } from "@/asset/sep11/index.ts";
import type { SEP11Asset } from "@/asset/sep11/types.ts";

/**
 * SAC Set Authorized Event Schema
 *
 * Topics: [symbol("set_authorized"), account: Address, asset: String]
 * Value: authorize: bool
 *
 * Note: CAP-0067 removed the admin from the topics.
 */
export const SetAuthorizedEventSchema = {
  name: "set_authorized",
  topics: [
    { name: "account", type: "address" },
    { name: "asset", type: "string" },
  ],
  value: { name: "authorize", type: "bool" },
} as const satisfies EventSchema;

/**
 * SAC Set Authorized Event
 *
 * Emitted when authorization status is set for an account.
 *
 * Topics: [symbol("set_authorized"), account: Address, sep0011_asset: String]
 * Data: authorize: bool
 *
 * Note: CAP-0067 removed the admin from the topics.
 *
 * @example
 * // Check if an event is a SAC SetAuthorizedEvent
 * if (SetAuthorizedEvent.is(event)) {
 *   const setAuth = SetAuthorizedEvent.fromEvent(event);
 *   console.log("Account:", setAuth.account);
 *   console.log("Authorized:", setAuth.authorize);
 *   console.log("Asset:", setAuth.asset);
 * }
 */
export class SetAuthorizedEvent extends EventTemplate<
  typeof SetAuthorizedEventSchema
> {
  static override schema = SetAuthorizedEventSchema;

  /** The address being (de-)authorized. */
  get account(): string {
    return this.get("account");
  }

  /** The SEP-11 asset string (e.g., "USDC:G..." or "native"). */
  get asset(): SEP11Asset {
    const val = this.get("asset");
    if (!isSEP11Asset(val)) {
      throw new Error(`Invalid SEP-11 asset format: ${val}`);
    }
    return val;
  }

  /** Whether the account is now authorized. */
  get authorize(): boolean {
    return this.get("authorize");
  }

  /**
   * Whether the `account` address is a valid Stellar account (G...).
   */
  isAccountAddress(): boolean {
    return StrKey.isValidEd25519PublicKey(this.account);
  }

  /**
   * Whether the `account` address is a valid contract (C...).
   */
  isAccountContract(): boolean {
    return StrKey.isValidContractId(this.account);
  }
}
