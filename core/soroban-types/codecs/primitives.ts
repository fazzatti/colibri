import { Address, scValToBigInt, XdrLargeInt } from "stellar-sdk/base";
import * as xdr from "stellar-sdk/xdr";
import { SorobanCodec } from "@/soroban-types/codecs/codec.ts";
import { SorobanValue } from "@/soroban-types/values/value.ts";
import { requireValue } from "@/soroban-types/error.ts";

/** @internal Exact native error discriminant names. */
type NativeErrorType = xdr.ScError["type"];

/** Native representation of a contract or host error value. */
export type SorobanErrorValue = { type: NativeErrorType; code: number };

/** @internal */
export function requireTag<T extends xdr.ScVal["type"]>(
  value: xdr.ScVal,
  tag: T,
): asserts value is Extract<xdr.ScVal, { type: T }> {
  requireValue(value.type === tag, tag, `received ${value.type}`);
}

/** @internal */
export function integerType<N extends "u32" | "i32">(
  name: N,
): SorobanCodec<number, number, N> {
  const signed = name === "i32";
  const min = signed ? -(2 ** 31) : 0;
  const max = signed ? 2 ** 31 - 1 : 2 ** 32 - 1;
  const validate = (value: unknown): number => {
    requireValue(
      typeof value === "number" && Number.isInteger(value) && value >= min &&
        value <= max,
      name,
      `expected an integer between ${min} and ${max}`,
    );
    return value;
  };
  return new SorobanCodec(
    name,
    name,
    (value) =>
      signed
        ? xdr.ScVal.scvI32(validate(value))
        : xdr.ScVal.scvU32(validate(value)),
    (value) => {
      requireTag(value, signed ? "scvI32" : "scvU32");
      return validate(value.value);
    },
  );
}

/** @internal */
export function largeIntegerType<
  N extends
    | "u64"
    | "i64"
    | "u128"
    | "i128"
    | "u256"
    | "i256"
    | "timepoint"
    | "duration",
>(name: N): SorobanCodec<bigint, bigint, N> {
  const tag = `scv${name[0].toUpperCase()}${
    name.slice(1)
  }` as xdr.ScVal["type"];
  return new SorobanCodec(name, name, (value) => {
    requireValue(typeof value === "bigint", name, "expected bigint");
    return new XdrLargeInt(name, value).toScVal();
  }, (value) => {
    requireTag(value, tag);
    return scValToBigInt(value);
  });
}

/** @internal */
export function boolType(): SorobanCodec<boolean, boolean, "bool"> {
  return new SorobanCodec("bool", "bool", (value) => {
    requireValue(typeof value === "boolean", "bool", "expected boolean");
    return xdr.ScVal.scvBool(value);
  }, (value) => {
    requireTag(value, "scvBool");
    return value.b;
  });
}

/** @internal */
export function voidType(): SorobanCodec<null | undefined, null, "void"> {
  return new SorobanCodec("void", "void", (value) => {
    requireValue(
      value === null || value === undefined,
      "void",
      "expected null or undefined",
    );
    return xdr.ScVal.scvVoid();
  }, (value) => {
    requireTag(value, "scvVoid");
    return null;
  });
}

/** @internal */
export function symbolType(): SorobanCodec<string, string, "symbol"> {
  const validate = (value: unknown): string => {
    requireValue(
      typeof value === "string" && /^[A-Za-z0-9_]{0,32}$/.test(value),
      "symbol",
      "expected at most 32 ASCII letters, digits or underscores",
    );
    return value;
  };
  return new SorobanCodec(
    "symbol",
    "symbol",
    (value) => xdr.ScVal.scvSymbol(validate(value)),
    (value) => {
      requireTag(value, "scvSymbol");
      return validate(value.sym.toString());
    },
  );
}

/** @internal */
export function stringType(): SorobanCodec<
  string | Uint8Array,
  string,
  "string"
> {
  return new SorobanCodec("string", "string", (value) => {
    requireValue(
      typeof value === "string" || value instanceof Uint8Array,
      "string",
      "expected text or bytes",
    );
    if (typeof value === "string") {
      requireValue(
        new TextDecoder("utf-8", { ignoreBOM: true }).decode(
          new TextEncoder().encode(value),
        ) === value,
        "string",
        "unpaired UTF-16 surrogate",
      );
    }
    return xdr.ScVal.scvString(value);
  }, (value) => {
    requireTag(value, "scvString");
    return value.str.toString();
  });
}

/** @internal */
export function bytesType<N extends number | undefined>(
  length: N,
): SorobanCodec<Uint8Array, Uint8Array, "bytes"> {
  if (length !== undefined) {
    requireValue(
      Number.isInteger(length) && length >= 0 && length <= 0xffff_ffff,
      "bytesN",
      "length must be u32",
    );
  }
  const validate = (value: unknown): Uint8Array => {
    requireValue(value instanceof Uint8Array, "bytes", "expected Uint8Array");
    requireValue(
      length === undefined || value.length === length,
      "bytesN",
      `expected ${length} bytes`,
    );
    return Uint8Array.from(value);
  };
  return new SorobanCodec(
    "bytes",
    length === undefined ? "bytes" : `bytesN(${length})`,
    (value) => {
      if (value instanceof SorobanValue) {
        const encoded = value.toScVal();
        requireTag(encoded, "scvBytes");
        return xdr.ScVal.scvBytes(validate(encoded.bytes.toBytes()));
      }
      return xdr.ScVal.scvBytes(validate(value));
    },
    (value) => {
      requireTag(value, "scvBytes");
      return validate(value.bytes.toBytes());
    },
    true,
  );
}

/** @internal */
export function addressType<N extends "address" | "muxedAddress">(
  name: N,
): SorobanCodec<string, string, N> {
  const validate = (value: xdr.ScVal): string => {
    requireTag(value, "scvAddress");
    const kind = value.address.type;
    requireValue(
      kind === "scAddressTypeAccount" || kind === "scAddressTypeContract" ||
        (name === "muxedAddress" && kind === "scAddressTypeMuxedAccount"),
      name,
      `unsupported ${kind}`,
    );
    return Address.fromScVal(value).toString();
  };
  return new SorobanCodec(
    name,
    name,
    (value) => {
      if (
        name === "muxedAddress" && value instanceof SorobanValue &&
        value.codec.identity === "address"
      ) {
        const encoded = value.toScVal();
        validate(encoded);
        return encoded;
      }
      requireValue(
        typeof value === "string",
        name,
        "expected a checksummed Stellar address",
      );
      const encoded = new Address(value).toScVal();
      validate(encoded);
      return encoded;
    },
    validate,
    name === "muxedAddress",
  );
}

/** @internal */
export function errorType(): SorobanCodec<
  SorobanErrorValue,
  SorobanErrorValue,
  "error"
> {
  return new SorobanCodec("error", "error", (value) => {
    requireValue(
      value !== null && typeof value === "object" && "type" in value &&
        "code" in value,
      "error",
      "expected { type, code }",
    );
    const code = integerType("u32").encodeUnknown(value.code).value as number;
    if (value.type === "sceContract") {
      return xdr.ScVal.scvError(xdr.ScError.sceContract(code));
    }
    const kind = xdr.ScErrorType.fromName(
      String(value.type) as xdr.ScError["type"],
    );
    const error = xdr.ScError.fromXdrObject(
      {
        type: kind.value,
        code: xdr.ScErrorCode.fromValue(code).value,
      } as xdr.ScErrorWire,
    );
    return xdr.ScVal.scvError(error);
  }, (value) => {
    requireTag(value, "scvError");
    const error = value.error;
    return {
      type: error.type,
      code: error.type === "sceContract"
        ? error.contractCode
        : error.code.value,
    };
  });
}

/** @internal Lossless coverage of every wire variant, including system-only values. */
export function valType(): SorobanCodec<
  xdr.ScVal | SorobanValue<unknown>,
  xdr.ScVal,
  "val"
> {
  return new SorobanCodec(
    "val",
    "val",
    (value) => {
      if (value instanceof SorobanValue) return value.toScVal();
      requireValue(
        xdr.ScVal.is(value),
        "val",
        "expected a native ScVal or Colibri value",
      );
      return xdr.ScVal.fromXdr(value.toXdr());
    },
    (value) => value,
    true,
  );
}
