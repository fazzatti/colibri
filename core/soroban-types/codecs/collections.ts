import {
  canonicalMap,
  requireOrderedMap,
} from "@/soroban-types/codecs/ordering.ts";
import * as xdr from "stellar-sdk/xdr";
import { SorobanCodec } from "@/soroban-types/codecs/codec.ts";
import type { SorobanValue } from "@/soroban-types/values/value.ts";
import { requireValue } from "@/soroban-types/error.ts";
import { requireTag } from "@/soroban-types/codecs/primitives.ts";

/** Explicit result value; error branches use the protocol's ScError representation. */
export type SorobanResultValue<T, E> = { ok: T; error?: never } | {
  error: E;
  ok?: never;
};
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
