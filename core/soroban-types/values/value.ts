import type { ScValLike } from "@/common/types/external.ts";
import * as xdr from "stellar-sdk/xdr";
import type { SorobanCodec } from "@/soroban-types/codecs/codec.ts";

/** Native ScVal or an immutable Colibri value, accepted by raw value boundaries. */
export type SorobanScValInput = ScValLike | SorobanValue<unknown>;

class EncodedValue {
  constructor(readonly value: ScValLike) {}
}

/** Immutable validated value. Native values and XDR objects are returned as copies. */
export class SorobanValue<Value, Name extends string = string> {
  /** Codec and structural ABI identity used by this value. */
  readonly codec: SorobanCodec<unknown, Value, Name>;
  readonly #bytes: Uint8Array;

  /** Validates and snapshots a value using an explicit schema. */
  constructor(codec: SorobanCodec<unknown, Value, Name>, value: unknown) {
    this.codec = codec;
    if (value instanceof EncodedValue) codec.decode(value.value);
    this.#bytes = Uint8Array.from(
      (value instanceof EncodedValue ? value.value : codec.encodeUnknown(value))
        .toXdr(),
    );
    Object.freeze(this);
  }

  /** @internal Preserves validated encoded data without a potentially lossy native round trip. */
  static fromEncoded<T, N extends string>(
    codec: SorobanCodec<unknown, T, N>,
    value: ScValLike,
  ): SorobanValue<T, N> {
    return new SorobanValue(codec, new EncodedValue(value));
  }

  /** The validated native value; each access returns an independent decoded value. */
  get value(): Value {
    return this.codec.decode(this.toScVal());
  }

  /** Returns a detached native Stellar SDK ScVal. */
  toScVal(): ScValLike {
    return xdr.ScVal.fromXdr(this.#bytes);
  }

  /** Serializes to raw XDR bytes. */
  toXdr(): Uint8Array;
  /** Serializes to base64 or hexadecimal text. */
  toXdr(format: "base64" | "hex"): string;
  toXdr(format?: "base64" | "hex"): Uint8Array | string {
    return format
      ? xdr.encodeBytes(this.#bytes, format)
      : Uint8Array.from(this.#bytes);
  }
}

/** Resolves an explicit wrapper at a raw ScVal boundary; native ScVals pass through. */
export function toSorobanScVal(value: SorobanScValInput): ScValLike {
  return value instanceof SorobanValue ? value.toScVal() : value;
}
