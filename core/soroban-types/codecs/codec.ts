import type { ScValLike } from "@/common/types/external.ts";
import * as xdr from "stellar-sdk/xdr";
import { Code, SorobanValueError } from "@/soroban-types/error.ts";
import { SorobanValue } from "@/soroban-types/values/value.ts";

/** A reusable, explicit Soroban schema with validation and bidirectional encoding. */
export class SorobanCodec<Input, Output = Input, Name extends string = string> {
  /** Human-readable type name. */
  readonly name: Name;
  /** @internal Structural ABI identity, including custom-type dependencies. */
  readonly identity: string;
  readonly #encode: (value: unknown) => ScValLike;
  readonly #decode: (value: ScValLike) => Output;
  readonly #acceptInner: boolean;

  /** @internal Creates a codec; use built-in `.type` descriptors or spec factories. */
  constructor(
    name: Name,
    identity: string,
    encode: (value: unknown) => ScValLike,
    decode: (value: ScValLike) => Output,
    acceptInner = false,
  ) {
    this.name = name;
    this.identity = identity;
    this.#encode = encode;
    this.#decode = decode;
    this.#acceptInner = acceptInner;
    Object.freeze(this);
  }

  /** Validates and wraps a native value or a compatible existing wrapper. */
  from(value: Input | SorobanValue<Output, Name>): SorobanValue<Output, Name> {
    return new SorobanValue(this, value);
  }

  /** Validates encoded data and preserves its exact wire representation. */
  fromScVal(value: ScValLike): SorobanValue<Output, Name> {
    this.decode(value);
    return SorobanValue.fromEncoded(this, value);
  }

  /** Decodes an XDR byte array or base64/hex string into a validated wrapper. */
  fromXdr(
    value: Uint8Array | string,
    format: "base64" | "hex" = "base64",
  ): SorobanValue<Output, Name> {
    try {
      return this.fromScVal(
        typeof value === "string"
          ? xdr.ScVal.fromXdr(value, format)
          : xdr.ScVal.fromXdr(value),
      );
    } catch (cause) {
      throw this.failure(cause);
    }
  }

  /** Encodes a value with runtime validation, including wrapped-value ABI identity. */
  encode(value: Input | SorobanValue<Output, Name>): ScValLike {
    return this.encodeUnknown(value);
  }

  /** @internal Runtime entrypoint for spec-driven and recursively composed codecs. */
  encodeUnknown(value: unknown): ScValLike {
    try {
      if (value instanceof SorobanValue) {
        if (value.codec.identity === this.identity) {
          const encoded = value.toScVal();
          this.#decode(encoded);
          return encoded;
        }
        if (!this.#acceptInner) {
          throw new SorobanValueError(
            Code.TYPE_MISMATCH,
            this.name,
            `received ${value.codec.name}`,
          );
        }
      }
      return xdr.ScVal.fromXdr(this.#encode(value).toXdr());
    } catch (cause) {
      throw this.failure(cause);
    }
  }

  /** Validates and decodes a ScVal; mutable results are detached from the input. */
  decode(value: ScValLike): Output {
    try {
      return this.#decode(xdr.ScVal.fromXdr(value.toXdr()));
    } catch (cause) {
      throw this.failure(cause);
    }
  }

  /** @internal Normalizes encoding failures into the value error family. */
  private failure(cause: unknown): SorobanValueError {
    return cause instanceof SorobanValueError ? cause : new SorobanValueError(
      Code.INVALID_VALUE,
      this.name,
      "value does not match its schema",
      cause,
    );
  }
}
