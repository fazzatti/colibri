import type { xdr } from "stellar-sdk";
import type { Spec } from "stellar-sdk/contract";
import * as E from "@/contract/events/error.ts";

const PRIMITIVES: Readonly<Record<string, string>> = {
  scSpecTypeBool: "scvBool",
  scSpecTypeVoid: "scvVoid",
  scSpecTypeError: "scvError",
  scSpecTypeU32: "scvU32",
  scSpecTypeI32: "scvI32",
  scSpecTypeU64: "scvU64",
  scSpecTypeI64: "scvI64",
  scSpecTypeU128: "scvU128",
  scSpecTypeI128: "scvI128",
  scSpecTypeU256: "scvU256",
  scSpecTypeI256: "scvI256",
  scSpecTypeTimepoint: "scvTimepoint",
  scSpecTypeDuration: "scvDuration",
  scSpecTypeBytes: "scvBytes",
  scSpecTypeString: "scvString",
  scSpecTypeSymbol: "scvSymbol",
  scSpecTypeAddress: "scvAddress",
  scSpecTypeMuxedAddress: "scvAddress",
};

/** @internal Reject partial/mistyped values before the SDK's permissive decoder. */
export function validateEventValue(
  spec: Spec,
  value: xdr.ScVal,
  type: xdr.ScSpecTypeDef,
  depth = 0,
): void {
  if (depth > 64) throw new E.INVALID_SPEC("event value nesting exceeds 64");
  if (validatePrimitive(value, type)) return;
  const recurse = (child: xdr.ScVal, childType: xdr.ScSpecTypeDef) =>
    validateEventValue(spec, child, childType, depth + 1);
  validateContainer(value, type, recurse, spec);
}

function validatePrimitive(value: xdr.ScVal, type: xdr.ScSpecTypeDef): boolean {
  const kind = type.type;
  const actual = value.type;
  if (kind === "scSpecTypeVal") return true;
  if (!(kind in PRIMITIVES)) return false;
  if (actual !== PRIMITIVES[kind]) {
    throw new E.INVALID_SPEC(`expected ${kind}, received ${actual}`);
  }
  if (
    kind === "scSpecTypeAddress" && value.type === "scvAddress" &&
    value.value.type === "scAddressTypeMuxedAccount"
  ) throw new E.INVALID_SPEC("muxed address in Address field");
  return true;
}

function validateContainer(
  value: xdr.ScVal,
  type: xdr.ScSpecTypeDef,
  recurse: Recurse,
  spec: Spec,
): void {
  const kind = type.type;
  const actual = value.type;
  if (kind === "scSpecTypeOption") {
    if (actual !== "scvVoid") recurse(value, type.value.valueType);
    return;
  }
  if (kind === "scSpecTypeResult") {
    if (actual !== "scvError") recurse(value, type.value.okType);
    return;
  }
  if (kind === "scSpecTypeBytesN") {
    if (actual !== "scvBytes" || value.value.value.length !== type.value.n) {
      throw new E.INVALID_SPEC("invalid fixed byte length");
    }
    return;
  }
  if (kind === "scSpecTypeVec") {
    for (const item of requireVec(value)) recurse(item, type.value.elementType);
    return;
  }
  if (kind === "scSpecTypeTuple") {
    validateTuple(requireVec(value), type.value.valueTypes, recurse);
    return;
  }
  if (kind === "scSpecTypeMap") {
    for (const entry of requireMap(value)) {
      recurse(entry.key, type.value.keyType);
      recurse(entry.val, type.value.valueType);
    }
    return;
  }
  if (kind === "scSpecTypeUdt") {
    validateUserType(spec, value, type.value.name.toString(), recurse);
    return;
  }
  throw new E.INVALID_SPEC(`unsupported type ${kind}`);
}

const requireVec = (value: xdr.ScVal): xdr.ScVal[] => {
  if (value.type !== "scvVec" || value.value === null) {
    throw new E.INVALID_SPEC("expected vector");
  }
  return value.value!;
};
/** @internal */
export const requireMap = (value: xdr.ScVal): xdr.ScMapEntry[] => {
  if (value.type !== "scvMap" || value.value === null) {
    throw new E.INVALID_SPEC("expected map");
  }
  return value.value!;
};
type Recurse = (value: xdr.ScVal, type: xdr.ScSpecTypeDef) => void;
const validateTuple = (
  values: xdr.ScVal[],
  types: xdr.ScSpecTypeDef[],
  recurse: Recurse,
): void => {
  if (values.length !== types.length) {
    throw new E.INVALID_SPEC("tuple length mismatch");
  }
  types.forEach((type, index) => recurse(values[index], type));
};
const validateUserType = (
  spec: Spec,
  value: xdr.ScVal,
  name: string,
  recurse: Recurse,
): void => {
  const entry = spec.findEntry(name);
  switch (entry.type) {
    case "scSpecEntryUdtStructV0": {
      const fields = entry.value.fields;
      if (fields.some((field) => /^\d+$/.test(field.name.toString()))) {
        validateTuple(
          requireVec(value),
          fields.map((field) => field.type),
          recurse,
        );
      } else {
        const entries = requireMap(value);
        if (entries.length !== fields.length) {
          throw new E.INVALID_SPEC("struct field count mismatch");
        }
        fields.forEach((field, index) => {
          const key = entries[index].key;
          if (
            key.type !== "scvSymbol" ||
            key.value.toString() !== field.name.toString()
          ) throw new E.INVALID_SPEC("struct key mismatch");
          recurse(entries[index].val, field.type);
        });
      }
      return;
    }
    case "scSpecEntryUdtUnionV0": {
      const values = requireVec(value);
      const tag = values[0];
      if (!tag || tag.type !== "scvSymbol") {
        throw new E.INVALID_SPEC("missing union tag");
      }
      const variant = entry.value.cases.find((item) =>
        item.value.name.toString() === tag.value.toString()
      );
      if (!variant) throw new E.INVALID_SPEC("unknown union tag");
      const types = variant.type === "scSpecUdtUnionCaseVoidV0"
        ? []
        : variant.value.type;
      validateTuple(values.slice(1), types, recurse);
      return;
    }
    case "scSpecEntryUdtEnumV0": {
      if (
        value.type !== "scvU32" ||
        !entry.value.cases.some((item) => item.value === value.value)
      ) throw new E.INVALID_SPEC("unknown enum value");
      return;
    }
    default:
      throw new E.INVALID_SPEC(`unsupported event user type ${name}`);
  }
};
