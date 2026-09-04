import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import * as E from "@/event/error.ts";
import type { EventSchema, SchemaField } from "@/event/types.ts";
import type { Event } from "@/event/event.ts";
import {
  decodeSEP41EventExtensions,
  getSEP41Amount,
  getSEP41EventExtensions,
  isSEP41AmountEventData,
} from "@/event/standards/sep41/data.ts";
import type {
  SEP41EventExtensionDecoder,
  SEP41EventExtensions,
} from "@/event/standards/sep41/types.ts";

/**
 * SEP-41 Burn Event Schema
 *
 * Topics: [symbol("burn"), from: Address]
 * Value: i128 (amount)
 */
export const BurnEventSchema: EventSchema<
  "burn",
  readonly [SchemaField<"from", "address">],
  SchemaField<"amount", "i128">
> = {
  name: "burn",
  topics: [{ name: "from", type: "address" }],
  value: { name: "amount", type: "i128", alternateTypes: ["map"] },
};

/**
 * SEP-41 Burn Event
 *
 * Emitted when an amount is burned from one address.
 *
 * Topics: [symbol("burn"), from: Address]
 * Data: i128 OR { amount: i128, ...extensions }
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

  /** Checks the topics and both SEP-41 burn data representations. */
  static override is(event: Event): boolean {
    return super.is(event) &&
      isSEP41AmountEventData(event, { muxedId: false });
  }

  /** The address from which tokens were burned. */
  get from(): string {
    return this.get("from");
  }

  /** The amount of tokens burned. */
  get amount(): bigint {
    return getSEP41Amount(this.value);
  }

  /** Non-standard fields from the map representation, or an empty object. */
  get extensions(): SEP41EventExtensions {
    return getSEP41EventExtensions(this.value, ["amount"]);
  }

  /**
   * Validates or transforms application-specific burn event fields.
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
      (cause, keys) => new E.BURN_EXTENSION_DECODER_FAILED(keys, cause),
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
}
