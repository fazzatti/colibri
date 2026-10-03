import { canonicalMap } from "@/soroban-types/codecs/ordering.ts";
import { recordFieldValues } from "@/soroban-types/codecs/record.ts";
import type { SorobanSpecOptions } from "@/soroban-types/codecs/spec-options.ts";
import { scValToNative } from "stellar-sdk/base";
import { contractValType } from "@/soroban-types/codecs/generic.ts";
import * as xdr from "stellar-sdk/xdr";
import type { Spec } from "@/contract/spec.ts";
import {
  requireValue,
  SorobanInvalidSchemaError,
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
/** @internal Only validated custom declarations enter the custom codec switches. */
type CustomEntry = Extract<xdr.ScSpecEntry, {
  type:
    | "scSpecEntryUdtStructV0"
    | "scSpecEntryUdtUnionV0"
    | "scSpecEntryUdtEnumV0"
    | "scSpecEntryUdtErrorEnumV0";
}>;

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
  readonly #entries: readonly CustomEntry[];
  #depth = 0;
  readonly #options: SorobanSpecOptions;
  constructor(
    spec: Pick<NativeSpec, "entries">,
    options: SorobanSpecOptions = {},
    private readonly nativeValues = false,
  ) {
    this.#options = { ...options };
    this.#entries = spec.entries.map((entry) =>
      xdr.ScSpecEntry.fromXdr(entry.toXdr())
    ).filter((entry): entry is CustomEntry =>
      entry.type === "scSpecEntryUdtStructV0" ||
      entry.type === "scSpecEntryUdtUnionV0" ||
      entry.type === "scSpecEntryUdtEnumV0" ||
      entry.type === "scSpecEntryUdtErrorEnumV0"
    );
  }

  private entry(name: string): CustomEntry {
    const entry = this.#entries.find((entry) =>
      entry.value.name.toString() === name
    );
    if (!entry) {
      throw new SorobanInvalidSchemaError(name, "unknown custom type");
    }
    return entry;
  }

  type(type: xdr.ScSpecTypeDef): SorobanCodec<unknown, unknown> {
    if (type.type === "scSpecTypeVal" && this.nativeValues) {
      const codec = contractValType();
      return new SorobanCodec(
        "val",
        "val",
        (value) => codec.encodeUnknown(value),
        (value) => scValToNative(codec.decode(value)),
      );
    }
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
    throw new SorobanInvalidSchemaError(
      String((type as { type?: unknown }).type),
      "unsupported spec type",
    );
  }

  custom(name: string): SorobanCodec<unknown, unknown> {
    const entry = this.entry(name);
    return new SorobanCodec(
      name,
      JSON.stringify(this.identity(name, new Set())),
      (value) => this.withDepth(() => this.encodeCustom(entry, value)),
      (value) => this.withDepth(() => this.decodeCustom(entry, value)),
    );
  }

  private withDepth<T>(run: () => T): T {
    requireValue(this.#depth < 64, "custom", "value nesting exceeds 64");
    this.#depth++;
    try {
      return run();
    } finally {
      this.#depth--;
    }
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
    }
  }

  private encodeCustom(entry: CustomEntry, value: unknown): xdr.ScVal {
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
    }
  }

  private decodeCustom(entry: CustomEntry, value: xdr.ScVal): unknown {
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
            Object.hasOwn(record, field.name.toString())
              ? record[field.name.toString()]
              : undefined,
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
    const values = recordFieldValues(
      value,
      entry.fields.map((field) => field.name.toString()),
      this.#options.structFields,
    );
    return Object.fromEntries(entry.fields.map((field, index) => [
      field.name.toString(),
      this.type(field.type).decode(values[index]),
    ]));
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
        names.every((name) => expected.includes(name)),
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

/**
 * Creates a validated codec from a custom declaration and its dependent types.
 * Named fields use evolution decoding by default; `options.structFields` can
 * request an exact field set. Encoding always writes the complete declared record.
 */
export function createSorobanType<Input, Output = Input>(
  spec: Pick<NativeSpec, "entries">,
  name: string,
  options: SorobanSpecOptions = {},
): SorobanCodec<Input, Output> {
  return new SpecTypes(spec, options).custom(name) as SorobanCodec<
    Input,
    Output
  >;
}

/**
 * Creates a codec for any supported contract-spec type, including composition.
 * `options.structFields` controls named records recursively without changing
 * positional tuple/union rules or dense encoding.
 */
export function sorobanTypeFromSpec<Input = unknown, Output = Input>(
  spec: Pick<NativeSpec, "entries">,
  type: NativeSpecType,
  options: SorobanSpecOptions = {},
): SorobanCodec<Input, Output> {
  return new SpecTypes(spec, options).type(type) as SorobanCodec<Input, Output>;
}
