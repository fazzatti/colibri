import {
  canonicalMap,
  requireOrderedMap,
} from "@/soroban-types/codecs/ordering.ts";
import { contractValType } from "@/soroban-types/codecs/generic.ts";
import * as xdr from "stellar-sdk/xdr";
import type { Spec } from "@/contract/spec.ts";
import {
  Code,
  requireValue,
  SorobanValueError,
} from "@/soroban-types/error.ts";
import { SorobanCodec } from "@/soroban-types/codecs/codec.ts";
import {
  addressType,
  boolType,
  bytesType,
  errorType,
  integerType,
  largeIntegerType,
  requireTag,
  stringType,
  symbolType,
  voidType,
} from "@/soroban-types/codecs/primitives.ts";
import {
  mapType,
  optionType,
  resultType,
  tupleType,
  vectorType,
} from "@/soroban-types/codecs/collections.ts";

/** @internal Exact native spec-type descriptor. */
type NativeSpecType = xdr.ScSpecTypeDef;
/** @internal Native SDK schema accepted without introducing a second constructor. */
type NativeSpec = Spec;

const SCALARS: Readonly<
  Record<string, (() => SorobanCodec<unknown, unknown>) | undefined>
> = {
  scSpecTypeVal: () => contractValType(),
  scSpecTypeBool: () => boolType(),
  scSpecTypeVoid: () => voidType(),
  scSpecTypeError: () => errorType(),
  scSpecTypeU32: () => integerType("u32"),
  scSpecTypeI32: () => integerType("i32"),
  scSpecTypeU64: () => largeIntegerType("u64"),
  scSpecTypeI64: () => largeIntegerType("i64"),
  scSpecTypeU128: () => largeIntegerType("u128"),
  scSpecTypeI128: () => largeIntegerType("i128"),
  scSpecTypeU256: () => largeIntegerType("u256"),
  scSpecTypeI256: () => largeIntegerType("i256"),
  scSpecTypeTimepoint: () => largeIntegerType("timepoint"),
  scSpecTypeDuration: () => largeIntegerType("duration"),
  scSpecTypeBytes: () => bytesType(undefined),
  scSpecTypeString: () => stringType(),
  scSpecTypeSymbol: () => symbolType(),
  scSpecTypeAddress: () => addressType("address"),
  scSpecTypeMuxedAddress: () => addressType("muxedAddress"),
};

/** @internal A copied spec inventory sufficient to encode custom types without RPC or pipelines. */
export class SpecTypes {
  readonly #entries: readonly xdr.ScSpecEntry[];
  constructor(spec: Pick<NativeSpec, "entries">) {
    this.#entries = spec.entries.map((entry) =>
      xdr.ScSpecEntry.fromXdr(entry.toXdr())
    );
  }

  private entry(name: string): xdr.ScSpecEntry {
    const entry = this.#entries.find((entry) =>
      entry.type.startsWith("scSpecEntryUdt") && "name" in entry.value &&
      entry.value.name.toString() === name
    );
    if (!entry) {
      throw new SorobanValueError(
        Code.INVALID_SCHEMA,
        name,
        "unknown custom type",
      );
    }
    return entry;
  }

  type(type: xdr.ScSpecTypeDef): SorobanCodec<unknown, unknown> {
    const scalar = SCALARS[type.type];
    if (scalar) return scalar();
    switch (type.type) {
      case "scSpecTypeBytesN":
        return bytesType(type.value.n);
      case "scSpecTypeVec":
        return vectorType(this.type(type.value.elementType));
      case "scSpecTypeMap":
        return mapType(
          this.type(type.value.keyType),
          this.type(type.value.valueType),
        );
      case "scSpecTypeTuple":
        return tupleType(type.value.valueTypes.map((item) => this.type(item)));
      case "scSpecTypeOption":
        return optionType(this.type(type.value.valueType));
      case "scSpecTypeResult":
        return resultType(
          this.type(type.value.okType),
          this.type(type.value.errorType),
        );
      case "scSpecTypeUdt":
        return this.custom(type.value.name.toString());
      default:
        return this.unsupported(type as never);
    }
  }

  private unsupported(type: never): never {
    throw new SorobanValueError(
      Code.INVALID_SCHEMA,
      String((type as { type?: unknown }).type),
      "unsupported spec type",
    );
  }

  custom(name: string): SorobanCodec<unknown, unknown> {
    const entry = this.entry(name);
    return new SorobanCodec(
      name,
      JSON.stringify(this.identity(name, new Set())),
      (value) => this.encodeCustom(entry, value),
      (value) => this.decodeCustom(entry, value),
    );
  }

  // Only ABI shape participates; documentation and unrelated functions do not.
  private identity(name: string, seen: Set<string>): unknown {
    if (seen.has(name)) return ["ref", name];
    const next = new Set(seen).add(name);
    const entry = this.entry(name);
    const type = (value: xdr.ScSpecTypeDef): unknown => {
      const refs: unknown[] = [];
      const visit = (value: xdr.ScSpecTypeDef): void => {
        switch (value.type) {
          case "scSpecTypeUdt":
            refs.push(this.identity(value.value.name.toString(), next));
            break;
          case "scSpecTypeVec":
            visit(value.value.elementType);
            break;
          case "scSpecTypeOption":
            visit(value.value.valueType);
            break;
          case "scSpecTypeMap":
            visit(value.value.keyType);
            visit(value.value.valueType);
            break;
          case "scSpecTypeResult":
            visit(value.value.okType);
            visit(value.value.errorType);
            break;
          case "scSpecTypeTuple":
            value.value.valueTypes.forEach(visit);
            break;
        }
      };
      visit(value);
      return [value.toXdr("base64"), refs];
    };
    switch (entry.type) {
      case "scSpecEntryUdtStructV0":
        return [
          name,
          "struct",
          entry.value.fields.map((
            field,
          ) => [field.name.toString(), type(field.type)]),
        ];
      case "scSpecEntryUdtUnionV0":
        return [
          name,
          "union",
          entry.value.cases.map((
            item,
          ) => [
            item.value.name.toString(),
            item.type,
            item.type === "scSpecUdtUnionCaseTupleV0"
              ? item.value.type.map(type)
              : [],
          ]),
        ];
      case "scSpecEntryUdtEnumV0":
      case "scSpecEntryUdtErrorEnumV0":
        return [
          name,
          entry.type,
          entry.value.cases.map((item) => [item.name.toString(), item.value]),
        ];
      default:
        throw new SorobanValueError(
          Code.INVALID_SCHEMA,
          name,
          "expected custom type declaration",
        );
    }
  }

  private encodeCustom(entry: xdr.ScSpecEntry, value: unknown): xdr.ScVal {
    switch (entry.type) {
      case "scSpecEntryUdtStructV0":
        return this.encodeStruct(entry.value, value);
      case "scSpecEntryUdtUnionV0":
        return this.encodeUnion(entry.value, value);
      case "scSpecEntryUdtEnumV0":
      case "scSpecEntryUdtErrorEnumV0":
        requireValue(
          entry.value.cases.some((item) => item.value === value),
          entry.value.name.toString(),
          "unknown enum code",
        );
        return integerType("u32").encodeUnknown(value);
      default:
        throw new SorobanValueError(
          Code.INVALID_SCHEMA,
          "custom",
          "expected custom declaration",
        );
    }
  }

  private decodeCustom(entry: xdr.ScSpecEntry, value: xdr.ScVal): unknown {
    switch (entry.type) {
      case "scSpecEntryUdtStructV0":
        return this.decodeStruct(entry.value, value);
      case "scSpecEntryUdtUnionV0":
        return this.decodeUnion(entry.value, value);
      case "scSpecEntryUdtEnumV0":
      case "scSpecEntryUdtErrorEnumV0": {
        const decoded = integerType("u32").decode(value);
        requireValue(
          entry.value.cases.some((item) => item.value === decoded),
          entry.value.name.toString(),
          "unknown enum code",
        );
        return decoded;
      }
      default:
        throw new SorobanValueError(
          Code.INVALID_SCHEMA,
          "custom",
          "expected custom declaration",
        );
    }
  }

  private tupleFields(
    entry: xdr.ScSpecUdtStructV0,
  ): SorobanCodec<unknown, unknown>[] | undefined {
    if (!entry.fields.some((field) => /^\d+$/.test(field.name.toString()))) {
      return;
    }
    requireValue(
      entry.fields.every((field, index) =>
        field.name.toString() === String(index)
      ),
      entry.name.toString(),
      "invalid tuple field order",
    );
    return entry.fields.map((field) => this.type(field.type));
  }

  private encodeStruct(
    entry: xdr.ScSpecUdtStructV0,
    value: unknown,
  ): xdr.ScVal {
    const tuple = this.tupleFields(entry);
    if (tuple) return tupleType(tuple).encodeUnknown(value);
    const record = this.record(value, entry.name.toString());
    const fields = entry.fields;
    this.requireFields(entry, Object.keys(record));
    return xdr.ScVal.scvMap(
      canonicalMap(fields.map((field) =>
        new xdr.ScMapEntry({
          key: symbolType().encodeUnknown(field.name.toString()),
          val: this.type(field.type).encodeUnknown(
            record[field.name.toString()],
          ),
        })
      )),
    );
  }

  private decodeStruct(
    entry: xdr.ScSpecUdtStructV0,
    value: xdr.ScVal,
  ): unknown {
    const tuple = this.tupleFields(entry);
    if (tuple) return tupleType(tuple).decode(value);
    requireTag(value, "scvMap");
    requireValue(
      value.map !== null,
      entry.name.toString(),
      "expected a field map",
    );
    requireOrderedMap(value.map);
    const fields = new Map(
      value.map.map((pair) => [symbolType().decode(pair.key), pair.val]),
    );
    requireValue(
      fields.size === value.map.length,
      entry.name.toString(),
      "duplicate fields",
    );
    this.requireFields(entry, [...fields.keys()]);
    return Object.fromEntries(
      entry.fields.map((
        field,
      ) => [
        field.name.toString(),
        this.type(field.type).decode(fields.get(field.name.toString())!),
      ]),
    );
  }

  private record(value: unknown, name: string): Record<string, unknown> {
    requireValue(
      value !== null && typeof value === "object" &&
        (Object.getPrototypeOf(value) === Object.prototype ||
          Object.getPrototypeOf(value) === null),
      name,
      "expected a plain object",
    );
    return value as Record<string, unknown>;
  }

  private requireFields(entry: xdr.ScSpecUdtStructV0, names: string[]): void {
    const expected = entry.fields.map((field) => field.name.toString());
    requireValue(
      new Set(expected).size === expected.length &&
        expected.length === names.length &&
        expected.every((name) => names.includes(name)),
      entry.name.toString(),
      "fields do not match the spec",
    );
  }

  private encodeUnion(entry: xdr.ScSpecUdtUnionV0, value: unknown): xdr.ScVal {
    const record = this.record(value, entry.name.toString());
    const item = entry.cases.find((item) =>
      item.value.name.toString() === record.tag
    );
    requireValue(item, entry.name.toString(), "unknown union tag");
    const tag = symbolType().encodeUnknown(record.tag);
    if (item.type === "scSpecUdtUnionCaseVoidV0") {
      requireValue(
        record.values === undefined,
        entry.name.toString(),
        "void case has no payload",
      );
      return xdr.ScVal.scvVec([tag]);
    }
    const payload = tupleType(item.value.type.map((type) => this.type(type)))
      .encodeUnknown(record.values);
    requireTag(payload, "scvVec");
    return xdr.ScVal.scvVec([tag, ...payload.vec!]);
  }

  private decodeUnion(entry: xdr.ScSpecUdtUnionV0, value: xdr.ScVal): unknown {
    requireTag(value, "scvVec");
    requireValue(
      value.vec && value.vec.length > 0,
      entry.name.toString(),
      "missing union tag",
    );
    const tag = symbolType().decode(value.vec[0]);
    const item = entry.cases.find((item) => item.value.name.toString() === tag);
    requireValue(item, entry.name.toString(), "unknown union tag");
    if (item.type === "scSpecUdtUnionCaseVoidV0") {
      requireValue(
        value.vec.length === 1,
        entry.name.toString(),
        "void case has no payload",
      );
      return { tag };
    }
    const values = tupleType(item.value.type.map((type) => this.type(type)))
      .decode(xdr.ScVal.scvVec(value.vec.slice(1)));
    return { tag, values };
  }
}

/** Creates a validated codec from a custom declaration and its dependent types. */
export function createSorobanType<Input, Output = Input>(
  spec: Pick<NativeSpec, "entries">,
  name: string,
): SorobanCodec<Input, Output> {
  return new SpecTypes(spec).custom(name) as SorobanCodec<Input, Output>;
}

/** Creates a codec for any supported contract-spec type, including composition. */
export function sorobanTypeFromSpec<Input = unknown, Output = Input>(
  spec: Pick<NativeSpec, "entries">,
  type: NativeSpecType,
): SorobanCodec<Input, Output> {
  return new SpecTypes(spec).type(type) as SorobanCodec<Input, Output>;
}
