import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import * as E from "@/event/error.ts";
import type { EventSchema, SchemaField } from "@/event/types.ts";
import type { Event } from "@/event/event.ts";
import {
  decodeSEP41EventExtensions,
  getSEP41ApproveData,
  getSEP41EventExtensions,
  isSEP41ApproveEventData,
} from "@/event/standards/sep41/data.ts";
import type {
  SEP41EventExtensionDecoder,
  SEP41EventExtensions,
} from "@/event/standards/sep41/types.ts";

/**
 * SEP-41 Approve Event Schema
 *
 * Topics: [symbol("approve"), from: Address, spender: Address]
 * Value: vec [amount: i128, live_until_ledger: u32] or a map containing
 * `amount` and `live_until_ledger`.
 */
export const ApproveEventSchema: EventSchema<
  "approve",
  readonly [
    SchemaField<"from", "address">,
    SchemaField<"spender", "address">,
  ],
  SchemaField<"data", "vec">
> = {
  name: "approve",
  topics: [
    { name: "from", type: "address" },
    { name: "spender", type: "address" },
  ],
  value: { name: "data", type: "vec", alternateTypes: ["map"] },
};

/**
 * SEP-41 Approve Event
 *
 * Emitted when the allowance is set for a spender to transfer tokens
 * from an owner's balance.
 *
 * Topics: [symbol("approve"), from: Address, spender: Address]
 * Data: [amount: i128, live_until_ledger: u32] OR
 * { amount: i128, live_until_ledger: u32, ...extensions }
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

  /** Checks the topics and both SEP-41 approve data representations. */
  static override is(event: Event): boolean {
    return super.is(event) && isSEP41ApproveEventData(event);
  }

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
    return getSEP41ApproveData(this.value).amount;
  }

  /**
   * The ledger number when this allowance expires.
   */
  get liveUntilLedger(): number {
    return getSEP41ApproveData(this.value).liveUntilLedger;
  }

  /** Non-standard fields from the map representation, or an empty object. */
  get extensions(): SEP41EventExtensions {
    return getSEP41EventExtensions(this.value, [
      "amount",
      "live_until_ledger",
    ]);
  }

  /**
   * Validates or transforms application-specific approve event fields.
   *
   * @param decoder Runtime decoder supplied by the consuming application.
   * @returns The decoder's typed output.
   */
  decodeExtensions<Output>(
    decoder: SEP41EventExtensionDecoder<Output>,
  ): Output {
    return decodeSEP41EventExtensions(
      this.extensions,
      decoder,
      (cause, keys) => new E.APPROVE_EXTENSION_DECODER_FAILED(keys, cause),
    );
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
