import type { ScValLike } from "@/common/types/external.ts";
import type * as xdr from "stellar-sdk/xdr";
import { Ok } from "stellar-sdk/contract";
import type { Spec } from "@/contract/spec.ts";
/** @internal Native SDK schema accepted without introducing a second constructor. */
type NativeSpec = Spec;
import { requireValue } from "@/values/error.ts";
import { SpecTypes } from "@/values/spec.ts";
import {
  type SorobanScValInput,
  SorobanValue,
  toSorobanScVal,
} from "@/values/value.ts";
import { requireContractValue } from "@/values/generic.ts";

/** @internal Finds explicit wrappers without treating arbitrary toScVal methods as trusted. */
export function containsSorobanValue(
  value: unknown,
  seen = new Set<object>(),
): boolean {
  if (value instanceof SorobanValue) return true;
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (value instanceof Map) {
    return [...value].some(([key, item]) =>
      containsSorobanValue(key, seen) || containsSorobanValue(item, seen)
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsSorobanValue(item, seen));
  }
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) return false;
  return Object.values(value).some((item) => containsSorobanValue(item, seen));
}

/** @internal Identifies only the spec cases absent from the native SDK's value codec. */
export function needsExtendedCodec(
  spec: NativeSpec,
  type: xdr.ScSpecTypeDef,
  seen = new Set<string>(),
): boolean {
  switch (type.type) {
    case "scSpecTypeError":
    case "scSpecTypeResult":
      return true;
    case "scSpecTypeOption":
      return needsExtendedCodec(spec, type.value.valueType, seen);
    case "scSpecTypeVec":
      return needsExtendedCodec(spec, type.value.elementType, seen);
    case "scSpecTypeMap":
      return needsExtendedCodec(spec, type.value.keyType, seen) ||
        needsExtendedCodec(spec, type.value.valueType, seen);
    case "scSpecTypeTuple":
      return type.value.valueTypes.some((item) =>
        needsExtendedCodec(spec, item, seen)
      );
    case "scSpecTypeUdt": {
      const name = type.value.name.toString();
      if (seen.has(name)) return false;
      seen.add(name);
      return customNeedsExtendedCodec(spec, name, seen);
    }
    default:
      return false;
  }
}

function customNeedsExtendedCodec(
  spec: NativeSpec,
  name: string,
  seen: Set<string>,
): boolean {
  const entry = spec.findEntry(name);
  switch (entry.type) {
    case "scSpecEntryUdtErrorEnumV0":
      return true;
    case "scSpecEntryUdtStructV0":
      return entry.value.fields.some((field) =>
        needsExtendedCodec(spec, field.type, seen)
      );
    case "scSpecEntryUdtUnionV0":
      return entry.value.cases.some((item) =>
        item.type === "scSpecUdtUnionCaseTupleV0" &&
        item.value.type.some((type) => needsExtendedCodec(spec, type, seen))
      );
    default:
      return false;
  }
}

/** Encodes named arguments, adding validated values while retaining native encoding for existing calls. */
export function encodeSorobanArguments(
  spec: NativeSpec,
  method: string,
  args: object,
): ScValLike[] {
  const fields = spec.getFunc(method).inputs;
  if (
    !containsSorobanValue(args) &&
    !fields.some((field) => needsExtendedCodec(spec, field.type))
  ) {
    return spec.funcArgsToScVals(method, args);
  }
  const entries = Object.entries(args);
  const types = new SpecTypes(spec);
  return fields.map((field) => {
    const entry = entries.find(([name]) => name === field.name.toString());
    requireValue(entry, method, `missing field ${field.name}`);
    return containsSorobanValue(entry[1]) ||
        needsExtendedCodec(spec, field.type)
      ? types.type(field.type).encodeUnknown(entry[1])
      : spec.nativeToScVal(entry[1], field.type);
  });
}

/** Decodes a function result, preserving native Result objects and existing plain outputs. */
export function decodeSorobanResult(
  spec: NativeSpec,
  method: string,
  value: ScValLike,
): unknown {
  const outputs = spec.getFunc(method).outputs;
  if (outputs.length !== 1) return spec.funcResToNative(method, value);
  const output = outputs[0];
  if (output.type === "scSpecTypeResult") {
    if (
      value.type === "scvError" ||
      !needsExtendedCodec(spec, output.value.okType)
    ) return spec.funcResToNative(method, value);
    return new Ok(new SpecTypes(spec).type(output.value.okType).decode(value));
  }
  return needsExtendedCodec(spec, output)
    ? new SpecTypes(spec).type(output).decode(value)
    : spec.funcResToNative(method, value);
}

/** @internal Validates new wrapped arguments while leaving native raw calls unchanged. */
export function toContractScVal(value: SorobanScValInput): ScValLike {
  const encoded = toSorobanScVal(value);
  if (value instanceof SorobanValue) requireContractValue(encoded);
  return encoded;
}
