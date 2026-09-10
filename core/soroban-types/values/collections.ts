import type { SorobanCodec } from "@/soroban-types/codecs/codec.ts";
import { SorobanValue } from "@/soroban-types/values/value.ts";
import {
  mapType,
  optionType,
  resultType,
  tupleType,
  vectorType,
} from "@/soroban-types/codecs/collections.ts";
import type { SorobanResultValue } from "@/soroban-types/codecs/collections.ts";
export type { SorobanResultValue } from "@/soroban-types/codecs/collections.ts";

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
/** Native result branches or a validated result. */
export type SorobanResultInput<T, E, TO = T, EO = E> =
  | SorobanResultValue<T, E>
  | SorobanValue<SorobanResultValue<TO, EO>, "result">;

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
