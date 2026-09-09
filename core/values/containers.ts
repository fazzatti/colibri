import { canonicalMap, requireOrderedMap } from "@/values/ordering.ts";
import * as xdr from "stellar-sdk/xdr";
import { SorobanCodec, SorobanValue } from "@/values/value.ts";
import { requireValue } from "@/values/error.ts";
import { requireTag } from "@/values/scalars.ts";

/** Ordinary vector elements or a validated vector. */
export type SorobanVecInput<I, O = I> =
  | Array<I>
  | SorobanValue<Array<O>, "vec">;
/** Ordinary map entries or a validated map; decoding returns entry pairs. */
export type SorobanMapInput<K, V, KO = K, VO = V> =
  | Map<K, V>
  | Array<[K, V]>
  | SorobanValue<Array<[KO, VO]>, "map">;
/** An optional value; None shares the protocol's void representation. */
export type SorobanOptionInput<I, O = I> =
  | I
  | null
  | undefined
  | SorobanValue<O | null, "option">;
/** Explicit result value; error branches use the protocol's ScError representation. */
export type SorobanResultValue<T, E> = { ok: T; error?: never } | {
  error: E;
  ok?: never;
};
/** Native result branches or a validated result. */
export type SorobanResultInput<T, E, TO = T, EO = E> =
  | SorobanResultValue<T, E>
  | SorobanValue<SorobanResultValue<TO, EO>, "result">;

/** @internal */
export function vectorType<I, O>(
  element: SorobanCodec<I, O>,
): SorobanCodec<Array<I | SorobanValue<O>>, Array<O>, "vec"> {
  return new SorobanCodec("vec", `vec(${element.identity})`, (value) => {
    requireValue(Array.isArray(value), "vec", "expected an array");
    return xdr.ScVal.scvVec(value.map((item) => element.encodeUnknown(item)));
  }, (value) => {
    requireTag(value, "scvVec");
    requireValue(
      value.vec !== null,
      "vec",
      "null wire vector is not a contract vector",
    );
    return value.vec.map((item) => element.decode(item));
  });
}

/** @internal */
export function tupleType(
  types: readonly SorobanCodec<unknown, unknown>[],
): SorobanCodec<unknown[], unknown[], "tuple"> {
  const fields = [...types];
  return new SorobanCodec(
    "tuple",
    `tuple(${fields.map((type) => type.identity).join(",")})`,
    (value) => {
      requireValue(
        Array.isArray(value) && value.length === fields.length,
        "tuple",
        `expected ${fields.length} fields`,
      );
      return xdr.ScVal.scvVec(
        fields.map((field, index) => field.encodeUnknown(value[index])),
      );
    },
    (value) => {
      requireTag(value, "scvVec");
      requireValue(
        value.vec?.length === fields.length,
        "tuple",
        `expected ${fields.length} fields`,
      );
      return fields.map((field, index) => field.decode(value.vec![index]));
    },
  );
}

/** @internal */
export function mapType<K, V, KO, VO>(
  key: SorobanCodec<K, KO>,
  item: SorobanCodec<V, VO>,
): SorobanCodec<
  | Map<K | SorobanValue<KO>, V | SorobanValue<VO>>
  | Array<[K | SorobanValue<KO>, V | SorobanValue<VO>]>,
  Array<[KO, VO]>,
  "map"
> {
  return new SorobanCodec(
    "map",
    `map(${key.identity},${item.identity})`,
    (value) => {
      requireValue(
        value instanceof Map || Array.isArray(value),
        "map",
        "expected a Map or entry pairs",
      );
      const entries = [...value].map((pair) => {
        requireValue(
          Array.isArray(pair) && pair.length === 2,
          "map",
          "expected [key, value]",
        );
        return new xdr.ScMapEntry({
          key: key.encodeUnknown(pair[0]),
          val: item.encodeUnknown(pair[1]),
        });
      });
      return xdr.ScVal.scvMap(canonicalMap(entries));
    },
    (value) => {
      requireTag(value, "scvMap");
      requireValue(
        value.map !== null,
        "map",
        "null wire map is not a contract map",
      );
      requireOrderedMap(value.map);
      return value.map.map((
        entry,
      ) => [key.decode(entry.key), item.decode(entry.val)]);
    },
  );
}

/** @internal */
export function optionType<I, O>(
  inner: SorobanCodec<I, O>,
): SorobanCodec<I | SorobanValue<O> | null | undefined, O | null, "option"> {
  return new SorobanCodec(
    "option",
    `option(${inner.identity})`,
    (value) =>
      value === null || value === undefined
        ? xdr.ScVal.scvVoid()
        : inner.encodeUnknown(value),
    (value) => value.type === "scvVoid" ? null : inner.decode(value),
    true,
  );
}

/** @internal */
export function resultType<I, E, O, EO>(
  ok: SorobanCodec<I, O>,
  error: SorobanCodec<E, EO>,
): SorobanCodec<
  SorobanResultValue<I | SorobanValue<O>, E | SorobanValue<EO>>,
  SorobanResultValue<O, EO>,
  "result"
> {
  return new SorobanCodec(
    "result",
    `result(${ok.identity},${error.identity})`,
    (value) => {
      requireValue(
        value !== null && typeof value === "object" &&
          (("ok" in value) !== ("error" in value)),
        "result",
        "expected exactly one of ok or error",
      );
      if ("ok" in value) {
        const encoded = ok.encodeUnknown(value.ok);
        requireValue(
          encoded.type !== "scvError",
          "result",
          "Ok cannot be represented by an ScError",
        );
        return encoded;
      }
      requireValue("error" in value, "result", "missing error branch");
      const encoded = error.encodeUnknown(value.error);
      if (encoded.type === "scvError") return encoded;
      requireTag(encoded, "scvU32");
      return xdr.ScVal.scvError(xdr.ScError.sceContract(encoded.u32));
    },
    (value) => {
      if (value.type !== "scvError") return { ok: ok.decode(value) };
      if (error.name === "error") return { error: error.decode(value) };
      requireValue(
        value.error.type === "sceContract",
        "result",
        "expected a contract error code",
      );
      return {
        error: error.decode(xdr.ScVal.scvU32(value.error.contractCode)),
      };
    },
  );
}

/** Validated vector whose element schema also describes an empty vector. */
export class SorobanVec<I, O = I> extends SorobanValue<O[], "vec"> {
  /** Validates all elements against an explicit element schema. */
  constructor(value: Array<I | SorobanValue<O>>, element: SorobanCodec<I, O>) {
    super(vectorType(element), value);
  }
  /** Creates a reusable vector schema. */
  static type<I, O>(
    element: SorobanCodec<I, O>,
  ): SorobanCodec<Array<I | SorobanValue<O>>, O[], "vec"> {
    return vectorType(element);
  }
}

/** Validated map with explicit key and value schemas. */
export class SorobanMap<K, V, KO = K, VO = V>
  extends SorobanValue<Array<[KO, VO]>, "map"> {
  /** Validates entry pairs and rejects duplicate encoded keys. */
  constructor(
    value:
      | Map<K | SorobanValue<KO>, V | SorobanValue<VO>>
      | Array<[K | SorobanValue<KO>, V | SorobanValue<VO>]>,
    key: SorobanCodec<K, KO>,
    item: SorobanCodec<V, VO>,
  ) {
    super(mapType(key, item), value);
  }
  /** Creates a reusable map schema. */
  static type<K, V, KO, VO>(
    key: SorobanCodec<K, KO>,
    item: SorobanCodec<V, VO>,
  ): SorobanCodec<
    | Map<K | SorobanValue<KO>, V | SorobanValue<VO>>
    | Array<[K | SorobanValue<KO>, V | SorobanValue<VO>]>,
    Array<[KO, VO]>,
    "map"
  > {
    return mapType(key, item);
  }
}

/** Input accepted by an explicit codec, including a compatible wrapper. */
export type SorobanTypeInput<Type> = Type extends
  SorobanCodec<infer I, infer O, infer N> ? I | SorobanValue<O, N> : never;
/** Native output decoded by an explicit codec. */
export type SorobanTypeOutput<Type> = Type extends
  SorobanCodec<unknown, infer O> ? O
  : never;
/** Positional inputs inferred from a tuple's schemas. */
export type SorobanTupleInput<
  Types extends readonly SorobanCodec<unknown, unknown>[],
> = { -readonly [Index in keyof Types]: SorobanTypeInput<Types[Index]> };
/** Positional decoded values inferred from a tuple's schemas. */
export type SorobanTupleOutput<
  Types extends readonly SorobanCodec<unknown, unknown>[],
> = { -readonly [Index in keyof Types]: SorobanTypeOutput<Types[Index]> };

/** Validated fixed-arity tuple with a schema for every position. */
export class SorobanTuple<
  Types extends readonly SorobanCodec<unknown, unknown>[],
> extends SorobanValue<SorobanTupleOutput<Types>, "tuple"> {
  /** Validates tuple arity and each field. */
  constructor(value: SorobanTupleInput<Types>, types: Types) {
    super(SorobanTuple.type(types), value);
  }
  /** Creates a reusable positional schema and infers its input/output tuple. */
  static type<const Types extends readonly SorobanCodec<unknown, unknown>[]>(
    types: Types,
  ): SorobanCodec<
    SorobanTupleInput<Types>,
    SorobanTupleOutput<Types>,
    "tuple"
  > {
    return tupleType(types) as SorobanCodec<
      SorobanTupleInput<Types>,
      SorobanTupleOutput<Types>,
      "tuple"
    >;
  }
}

/** Validated optional value. Null and undefined both encode None. */
export class SorobanOption<I, O = I> extends SorobanValue<O | null, "option"> {
  /** Validates Some against its explicit inner schema. */
  constructor(
    value: I | SorobanValue<O> | null | undefined,
    inner: SorobanCodec<I, O>,
  ) {
    super(optionType(inner), value);
  }
  /** Creates a reusable optional schema. */
  static type<I, O>(
    inner: SorobanCodec<I, O>,
  ): SorobanCodec<I | SorobanValue<O> | null | undefined, O | null, "option"> {
    return optionType(inner);
  }
}

/** Validated Result using Ok values and ScError failures on the wire. */
export class SorobanResult<I, E, O = I, EO = E>
  extends SorobanValue<SorobanResultValue<O, EO>, "result"> {
  /** Validates the selected branch against its explicit schema. */
  constructor(
    value: SorobanResultValue<I | SorobanValue<O>, E | SorobanValue<EO>>,
    ok: SorobanCodec<I, O>,
    error: SorobanCodec<E, EO>,
  ) {
    super(resultType(ok, error), value);
  }
  /** Creates a reusable result schema. */
  static type<I, E, O, EO>(
    ok: SorobanCodec<I, O>,
    error: SorobanCodec<E, EO>,
  ): SorobanCodec<
    SorobanResultValue<I | SorobanValue<O>, E | SorobanValue<EO>>,
    SorobanResultValue<O, EO>,
    "result"
  > {
    return resultType(ok, error);
  }
}
