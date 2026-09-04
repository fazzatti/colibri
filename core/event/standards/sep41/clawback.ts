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
 * SEP-41 Clawback Event Schema
 *
 * Topics: [symbol("clawback"), from: Address]
 * Value: i128 (amount)
 */
export const ClawbackEventSchema: EventSchema<
  "clawback",
  readonly [SchemaField<"from", "address">],
  SchemaField<"amount", "i128", readonly ["map"]>
> = {
  name: "clawback",
  topics: [{ name: "from", type: "address" }],
  value: { name: "amount", type: "i128", alternateTypes: ["map"] },
};

/**
 * SEP-41 Clawback Event
 *
 * Emitted when an amount of the token is clawed back from an address.
 *
 * Topics: [symbol("clawback"), from: Address]
 * Data: i128 OR { amount: i128, ...extensions }
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

  /** Checks the topics and both SEP-41 clawback data representations. */
  static override is(event: Event): boolean {
    return super.is(event) &&
      isSEP41AmountEventData(event, { muxedId: false });
  }

  /** The address from which tokens were clawed back. */
  get from(): string {
    return this.get("from");
  }

  /** The amount of tokens clawed back. */
  get amount(): bigint {
    return getSEP41Amount(this.value);
  }

  /** Non-standard fields from the map representation, or an empty object. */
  get extensions(): SEP41EventExtensions {
    return getSEP41EventExtensions(this.value, ["amount"]);
  }

  /**
   * Validates or transforms application-specific clawback event fields.
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
      (cause, keys) => new E.CLAWBACK_EXTENSION_DECODER_FAILED(keys, cause),
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
