import type { ScValLike } from "@/common/types/external.ts";
import type { SorobanCodec } from "@/soroban-types/codecs/codec.ts";
import { SorobanValue } from "@/soroban-types/values/value.ts";
import {
  addressType,
  boolType,
  bytesType,
  errorType,
  integerType,
  largeIntegerType,
  stringType,
  symbolType,
  valType,
  voidType,
} from "@/soroban-types/codecs/primitives.ts";
import type { SorobanErrorValue } from "@/soroban-types/codecs/primitives.ts";

/** Ordinary or validated Bool accepted by contract inputs. */
export type SorobanBoolInput = boolean | SorobanBool;
/** Immutable Soroban Bool; construction validates its representation. */
export class SorobanBool extends SorobanValue<boolean, "bool"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<boolean, boolean, "bool"> =
    /* @__PURE__ */ boolType();
  /** Validates and snapshots the supplied value. */
  constructor(value: boolean) {
    super(SorobanBool.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<boolean, "bool"> {
    return SorobanBool.type.fromScVal(value);
  }
}

/** Ordinary or validated Void accepted by contract inputs. */
export type SorobanVoidInput = null | undefined | SorobanVoid;
/** Immutable Soroban Void; construction validates its representation. */
export class SorobanVoid extends SorobanValue<null, "void"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<null | undefined, null, "void"> =
    /* @__PURE__ */ voidType();
  /** Validates and snapshots the supplied value. */
  constructor(value: null | undefined) {
    super(SorobanVoid.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<null, "void"> {
    return SorobanVoid.type.fromScVal(value);
  }
}

/** Ordinary or validated U32 accepted by contract inputs. */
export type SorobanU32Input = number | SorobanU32;
/** Immutable Soroban U32; construction validates its representation. */
export class SorobanU32 extends SorobanValue<number, "u32"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<number, number, "u32"> =
    /* @__PURE__ */ integerType("u32");
  /** Validates and snapshots the supplied value. */
  constructor(value: number) {
    super(SorobanU32.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<number, "u32"> {
    return SorobanU32.type.fromScVal(value);
  }
}

/** Ordinary or validated I32 accepted by contract inputs. */
export type SorobanI32Input = number | SorobanI32;
/** Immutable Soroban I32; construction validates its representation. */
export class SorobanI32 extends SorobanValue<number, "i32"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<number, number, "i32"> =
    /* @__PURE__ */ integerType("i32");
  /** Validates and snapshots the supplied value. */
  constructor(value: number) {
    super(SorobanI32.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<number, "i32"> {
    return SorobanI32.type.fromScVal(value);
  }
}

/** Ordinary or validated U64 accepted by contract inputs. */
export type SorobanU64Input = bigint | SorobanU64;
/** Immutable Soroban U64; construction validates its representation. */
export class SorobanU64 extends SorobanValue<bigint, "u64"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<bigint, bigint, "u64"> =
    /* @__PURE__ */ largeIntegerType("u64");
  /** Validates and snapshots the supplied value. */
  constructor(value: bigint) {
    super(SorobanU64.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<bigint, "u64"> {
    return SorobanU64.type.fromScVal(value);
  }
}

/** Ordinary or validated I64 accepted by contract inputs. */
export type SorobanI64Input = bigint | SorobanI64;
/** Immutable Soroban I64; construction validates its representation. */
export class SorobanI64 extends SorobanValue<bigint, "i64"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<bigint, bigint, "i64"> =
    /* @__PURE__ */ largeIntegerType("i64");
  /** Validates and snapshots the supplied value. */
  constructor(value: bigint) {
    super(SorobanI64.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<bigint, "i64"> {
    return SorobanI64.type.fromScVal(value);
  }
}

/** Ordinary or validated U128 accepted by contract inputs. */
export type SorobanU128Input = bigint | SorobanU128;
/** Immutable Soroban U128; construction validates its representation. */
export class SorobanU128 extends SorobanValue<bigint, "u128"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<bigint, bigint, "u128"> =
    /* @__PURE__ */ largeIntegerType("u128");
  /** Validates and snapshots the supplied value. */
  constructor(value: bigint) {
    super(SorobanU128.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<bigint, "u128"> {
    return SorobanU128.type.fromScVal(value);
  }
}

/** Ordinary or validated I128 accepted by contract inputs. */
export type SorobanI128Input = bigint | SorobanI128;
/** Immutable Soroban I128; construction validates its representation. */
export class SorobanI128 extends SorobanValue<bigint, "i128"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<bigint, bigint, "i128"> =
    /* @__PURE__ */ largeIntegerType("i128");
  /** Validates and snapshots the supplied value. */
  constructor(value: bigint) {
    super(SorobanI128.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<bigint, "i128"> {
    return SorobanI128.type.fromScVal(value);
  }
}

/** Ordinary or validated U256 accepted by contract inputs. */
export type SorobanU256Input = bigint | SorobanU256;
/** Immutable Soroban U256; construction validates its representation. */
export class SorobanU256 extends SorobanValue<bigint, "u256"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<bigint, bigint, "u256"> =
    /* @__PURE__ */ largeIntegerType("u256");
  /** Validates and snapshots the supplied value. */
  constructor(value: bigint) {
    super(SorobanU256.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<bigint, "u256"> {
    return SorobanU256.type.fromScVal(value);
  }
}

/** Ordinary or validated I256 accepted by contract inputs. */
export type SorobanI256Input = bigint | SorobanI256;
/** Immutable Soroban I256; construction validates its representation. */
export class SorobanI256 extends SorobanValue<bigint, "i256"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<bigint, bigint, "i256"> =
    /* @__PURE__ */ largeIntegerType("i256");
  /** Validates and snapshots the supplied value. */
  constructor(value: bigint) {
    super(SorobanI256.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<bigint, "i256"> {
    return SorobanI256.type.fromScVal(value);
  }
}

/** Ordinary or validated Timepoint accepted by contract inputs. */
export type SorobanTimepointInput = bigint | SorobanTimepoint;
/** Immutable Soroban Timepoint; construction validates its representation. */
export class SorobanTimepoint extends SorobanValue<bigint, "timepoint"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<bigint, bigint, "timepoint"> =
    /* @__PURE__ */ largeIntegerType("timepoint");
  /** Validates and snapshots the supplied value. */
  constructor(value: bigint) {
    super(SorobanTimepoint.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<bigint, "timepoint"> {
    return SorobanTimepoint.type.fromScVal(value);
  }
}

/** Ordinary or validated Duration accepted by contract inputs. */
export type SorobanDurationInput = bigint | SorobanDuration;
/** Immutable Soroban Duration; construction validates its representation. */
export class SorobanDuration extends SorobanValue<bigint, "duration"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<bigint, bigint, "duration"> =
    /* @__PURE__ */ largeIntegerType("duration");
  /** Validates and snapshots the supplied value. */
  constructor(value: bigint) {
    super(SorobanDuration.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<bigint, "duration"> {
    return SorobanDuration.type.fromScVal(value);
  }
}

/** Ordinary or validated Symbol accepted by contract inputs. */
export type SorobanSymbolInput = string | SorobanSymbol;
/** Immutable Soroban Symbol; construction validates its representation. */
export class SorobanSymbol extends SorobanValue<string, "symbol"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<string, string, "symbol"> =
    /* @__PURE__ */ symbolType();
  /** Validates and snapshots the supplied value. */
  constructor(value: string) {
    super(SorobanSymbol.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<string, "symbol"> {
    return SorobanSymbol.type.fromScVal(value);
  }
}

/** Ordinary or validated String accepted by contract inputs. */
export type SorobanStringInput = string | SorobanString;
/** Immutable Soroban String; construction validates its representation. */
export class SorobanString extends SorobanValue<string, "string"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<
    string | Uint8Array,
    string,
    "string"
  > = /* @__PURE__ */ stringType();
  /** Validates and snapshots the supplied value. */
  constructor(value: string | Uint8Array) {
    super(SorobanString.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(
    value: ScValLike,
  ): SorobanValue<string, "string"> {
    return SorobanString.type.fromScVal(value);
  }
}

/** Ordinary or validated Bytes accepted by contract inputs. */
export type SorobanBytesInput = Uint8Array | SorobanBytes;
/** Immutable Soroban Bytes; construction validates its representation. */
export class SorobanBytes extends SorobanValue<Uint8Array, "bytes"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<Uint8Array, Uint8Array, "bytes"> =
    /* @__PURE__ */ bytesType(undefined);
  /** Validates and snapshots the supplied value. */
  constructor(value: Uint8Array) {
    super(SorobanBytes.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<Uint8Array, "bytes"> {
    return SorobanBytes.type.fromScVal(value);
  }
}

/** Ordinary or validated Address accepted by contract inputs. */
export type SorobanAddressInput = string | SorobanAddress;
/** Immutable Soroban Address; construction validates its representation. */
export class SorobanAddress extends SorobanValue<string, "address"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<string, string, "address"> =
    /* @__PURE__ */ addressType("address");
  /** Validates and snapshots the supplied value. */
  constructor(value: string) {
    super(SorobanAddress.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<string, "address"> {
    return SorobanAddress.type.fromScVal(value);
  }
}

/** Ordinary or validated MuxedAddress accepted by contract inputs. */
export type SorobanMuxedAddressInput =
  | string
  | SorobanMuxedAddress
  | SorobanAddress;
/** Immutable Soroban MuxedAddress; construction validates its representation. */
export class SorobanMuxedAddress extends SorobanValue<string, "muxedAddress"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<
    string | SorobanAddress,
    string,
    "muxedAddress"
  > = /* @__PURE__ */ addressType("muxedAddress");
  /** Validates and snapshots the supplied value. */
  constructor(value: string | SorobanAddress) {
    super(SorobanMuxedAddress.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<string, "muxedAddress"> {
    return SorobanMuxedAddress.type.fromScVal(value);
  }
}

/** Ordinary or validated Error accepted by contract inputs. */
export type SorobanErrorInput = SorobanErrorValue | SorobanError;
/** Immutable Soroban Error; construction validates its representation. */
export class SorobanError extends SorobanValue<SorobanErrorValue, "error"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<
    SorobanErrorValue,
    SorobanErrorValue,
    "error"
  > = /* @__PURE__ */ errorType();
  /** Validates and snapshots the supplied value. */
  constructor(value: SorobanErrorValue) {
    super(SorobanError.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(
    value: ScValLike,
  ): SorobanValue<SorobanErrorValue, "error"> {
    return SorobanError.type.fromScVal(value);
  }
}

/** Ordinary or validated Val accepted by contract inputs. */
export type SorobanValInput = unknown | SorobanVal;
/** Immutable Soroban Val; construction validates its representation. */
export class SorobanVal extends SorobanValue<ScValLike, "val"> {
  /** Reusable schema for encoding, decoding and container composition. */
  static readonly type: SorobanCodec<
    ScValLike | SorobanValue<unknown>,
    ScValLike,
    "val"
  > = /* @__PURE__ */ valType();
  /** Validates and snapshots the supplied value. */
  constructor(value: ScValLike | SorobanValue<unknown>) {
    super(SorobanVal.type, value);
  }
  /** Validates and wraps an encoded value. */
  static fromScVal(value: ScValLike): SorobanValue<ScValLike, "val"> {
    return SorobanVal.type.fromScVal(value);
  }
}

/** Fixed-size bytes retain their required length in the schema identity. */
export class SorobanBytesN<N extends number = number>
  extends SorobanValue<SorobanFixedBytes<N>, "bytes"> {
  /** Validates a byte array against the exact required length. */
  constructor(value: SorobanBytesInput, length: N) {
    super(SorobanBytesN.type(length), value);
  }
  /** Builds a reusable fixed-length byte schema. */
  static type<N extends number>(
    length: N,
  ): SorobanCodec<SorobanBytesInput, SorobanFixedBytes<N>, "bytes"> {
    return bytesType(length) as SorobanCodec<
      Uint8Array,
      SorobanFixedBytes<N>,
      "bytes"
    >;
  }
}
/** Native SDK representation of fixed-length bytes. */
export type SorobanFixedBytes<N extends number = number> = Uint8Array & {
  readonly length: N;
};
/** Existing byte arrays or a fixed-length validated value. */
export type SorobanBytesNInput<N extends number = number> =
  | SorobanBytesInput
  | SorobanBytesN<N>;
