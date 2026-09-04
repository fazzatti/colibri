import { StrKey } from "@/strkeys/index.ts";
import { EventTemplate } from "@/event/template.ts";
import * as E from "@/event/error.ts";
import type { EventSchema, SchemaField } from "@/event/types.ts";
import type { Event } from "@/event/event.ts";
import {
  decodeSEP41EventExtensions,
  getSEP41Amount,
  getSEP41EventExtensions,
  getSEP41MuxedId,
  isSEP41AmountEventData,
} from "@/event/standards/sep41/data.ts";
import type {
  SEP41EventExtensionDecoder,
  SEP41EventExtensions,
  SEP41EventMuxedId,
} from "@/event/standards/sep41/types.ts";

/**
 * SEP-41 Mint Event Schema (simple variant)
 *
 * Topics: [symbol("mint"), to: Address]
 * Value: i128 (amount)
 */
export const MintEventSchema: EventSchema<
  "mint",
  readonly [SchemaField<"to", "address">],
  SchemaField<"amount", "i128", readonly ["map"]>
> = {
  name: "mint",
  topics: [{ name: "to", type: "address" }],
  value: { name: "amount", type: "i128", alternateTypes: ["map"] },
};

/**
 * SEP-41 Mint Event
 *
 * Emitted when tokens are minted.
 *
 * Topics: [symbol("mint"), to: Address]
 * Data: i128 OR map { amount: i128, to_muxed_id?: u64 | String | BytesN<32> }
 *
 * @example
 * // Check if an event is a MintEvent
 * if (MintEvent.is(event)) {
 *   const mint = MintEvent.fromEvent(event);
 *   console.log(mint.to, mint.amount);
 *
 *   // Check for muxed address
 *   if (mint.hasMuxedId()) {
 *     console.log("Muxed ID:", mint.toMuxedId);
 *   }
 * }
 *
 * // Create a topic filter
 * const filter = MintEvent.toTopicFilter({ to: "G..." });
 */
export class MintEvent extends EventTemplate<typeof MintEventSchema> {
  static override schema = MintEventSchema;

  /**
   * Checks if an event matches the SEP-41 MintEvent schema.
   * Overrides base implementation to accept both i128 and muxed map value formats.
   */
  static override is(event: Event): boolean {
    return super.is(event) &&
      isSEP41AmountEventData(event, { muxedId: true });
  }

  /** The recipient address that received the minted tokens. */
  get to(): string {
    return this.get("to");
  }

  /**
   * The amount of tokens minted.
   * Handles both simple (i128) and muxed (map) data formats.
   */
  get amount(): bigint {
    const amount = getSEP41Amount(this.value);
    if (amount === undefined) throw new E.INVALID_EVENT_DATA_FORMAT("mint");
    return amount;
  }

  /**
   * The raw CAP-67 `to_muxed_id` field if present.
   *
   * This value is exposed exactly as emitted in the event payload. Per CAP-67,
   * it can represent either a real muxed account ID for a muxed destination, or
   * transaction memo data mapped onto a classic non-muxed destination
   * (`MEMO_ID` -> `bigint`, `MEMO_TEXT` -> `string`, `MEMO_HASH` /
   * `MEMO_RETURN` -> `Uint8Array`).
   *
   * Do not assume that a present value is always a raw muxed-account ID without
   * considering the destination type and transaction context.
   */
  get toMuxedId(): SEP41EventMuxedId | undefined {
    return getSEP41MuxedId(this.value);
  }

  /**
   * Whether this mint event includes the CAP-67 `to_muxed_id` field.
   */
  hasMuxedId(): boolean {
    return this.toMuxedId !== undefined;
  }

  /** Non-standard fields from the map representation, or an empty object. */
  get extensions(): SEP41EventExtensions {
    return getSEP41EventExtensions(this.value, ["amount", "to_muxed_id"]);
  }

  /**
   * Validates or transforms application-specific mint event fields.
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
      (cause, keys) => new E.MINT_EXTENSION_DECODER_FAILED(keys, cause),
    );
  }

  /**
   * Whether the `to` address is a valid Stellar account (G...).
   */
  isToAccount(): boolean {
    return StrKey.isValidEd25519PublicKey(this.to);
  }

  /**
   * Whether the `to` address is a valid contract (C...).
   */
  isToContract(): boolean {
    return StrKey.isValidContractId(this.to);
  }
}
