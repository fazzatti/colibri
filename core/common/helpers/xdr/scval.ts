import { Address, scValToBigInt, type xdr } from "stellar-sdk";
import type {
  ScValMap,
  ScValParsed,
  ScValRecord,
  ScValTypeName,
} from "@/common/helpers/xdr/types.ts";
import {
  UNKNOWN_SCVAL_TYPE,
  UNSUPPORTED_SCVAL_TYPE,
} from "@/common/helpers/xdr/error.ts";

/**
 * Parse an xdr.ScVal into a TypeScript-friendly value.
 *
 * @param scv - The ScVal to parse
 * @returns The parsed TypeScript value
 * @throws Error if the ScVal type is not supported
 * @internal
 */
export function parseScVal(scv: xdr.ScVal): ScValParsed {
  const primitive = parsePrimitiveScVal(scv);
  if (primitive !== UNPARSED_SCVAL) return primitive;

  const scalar = parseScalarScVal(scv);
  if (scalar !== UNPARSED_SCVAL) return scalar;

  return parseStructuredScVal(scv);
}

const UNPARSED_SCVAL = Symbol("unparsed-scval");

const parsePrimitiveScVal = (
  scv: xdr.ScVal,
): ScValParsed | typeof UNPARSED_SCVAL => {
  switch (scv.type) {
    case "scvVoid":
      return null;
    case "scvBool":
      return scv.b;
    case "scvU32":
      return scv.u32;
    case "scvI32":
      return scv.i32;
    case "scvU64":
    case "scvI64":
    case "scvU128":
    case "scvI128":
    case "scvU256":
    case "scvI256":
      return scValToBigInt(scv);
    default:
      return UNPARSED_SCVAL;
  }
};

const parseScalarScVal = (
  scv: xdr.ScVal,
): ScValParsed | typeof UNPARSED_SCVAL => {
  switch (scv.type) {
    case "scvTimepoint":
      return scv.timepoint;
    case "scvDuration":
      return scv.duration;
    case "scvSymbol":
      return scv.sym.asStringOrBytes();
    case "scvString":
      return scv.str.asStringOrBytes();
    case "scvExecutableTag":
      return scv.executableTag.asStringOrBytes();
    case "scvBytes":
      return Uint8Array.from(scv.bytes.toBytes());
    case "scvAddress":
      return Address.fromScVal(scv).toString();
    default:
      return UNPARSED_SCVAL;
  }
};

const parseStructuredScVal = (scv: xdr.ScVal): ScValParsed => {
  switch (scv.type) {
    case "scvVec": {
      const vec = scv.vec ?? [];
      return vec.map(parseScVal);
    }
    case "scvMap": {
      const entries = scv.map ?? [];
      return parseScValMap(entries);
    }
    case "scvError": {
      const err = scv.error;
      return {
        type: err.type,
        code: err.type === "sceContract" ? err.contractCode : err.code.value,
      } as ScValRecord;
    }
    case "scvContractInstance": {
      const instance = scv.instance;
      return {
        executable: instance.executable.type,
      } as ScValRecord;
    }
    case "scvLedgerKeyContractInstance":
      return { ledgerKeyType: "contractInstance" } as ScValRecord;
    case "scvLedgerKeyNonce":
      return { ledgerKeyType: "nonce" } as ScValRecord;
    default:
      throw new UNSUPPORTED_SCVAL_TYPE((scv as { type: string }).type);
  }
};

/**
 * Parse ScMap entries into either a Record (if all keys are symbols/strings)
 * or a Map (if keys are mixed types).
 */
function parseScValMap(entries: xdr.ScMapEntry[]): ScValRecord | ScValMap {
  const parsed = entries.map((entry) => ({
    key: parseScVal(entry.key),
    value: parseScVal(entry.val),
  }));
  const allStringKeys = parsed.every((entry) => typeof entry.key === "string");

  if (allStringKeys) {
    // Return as plain object
    const result: ScValRecord = {};
    for (const entry of parsed) {
      result[entry.key as string] = entry.value;
    }
    return result;
  }

  // Return as Map for non-string keys
  const result: ScValMap = new Map();
  for (const entry of parsed) {
    result.set(entry.key, entry.value);
  }
  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the type name of an ScVal.
 * @internal
 */
export function getScValTypeName(scv: xdr.ScVal): ScValTypeName {
  const typeName = SCVAL_TYPE_NAMES.get(scv.type);
  if (typeName !== undefined) return typeName;
  throw new UNKNOWN_SCVAL_TYPE((scv as { type: string }).type);
}

const SCVAL_TYPE_NAMES = new Map<string, ScValTypeName>([
  ["scvVoid", "void"],
  ["scvBool", "bool"],
  ["scvU32", "u32"],
  ["scvI32", "i32"],
  ["scvU64", "u64"],
  ["scvI64", "i64"],
  ["scvU128", "u128"],
  ["scvI128", "i128"],
  ["scvU256", "u256"],
  ["scvI256", "i256"],
  ["scvTimepoint", "timepoint"],
  ["scvDuration", "duration"],
  ["scvSymbol", "symbol"],
  ["scvString", "string"],
  ["scvExecutableTag", "executableTag"],
  ["scvBytes", "bytes"],
  ["scvAddress", "address"],
  ["scvVec", "vec"],
  ["scvMap", "map"],
  ["scvError", "error"],
  ["scvContractInstance", "contractInstance"],
  ["scvLedgerKeyContractInstance", "ledgerKeyContractInstance"],
  ["scvLedgerKeyNonce", "ledgerKeyNonce"],
]);

/**
 * Check if a parsed value is a record (object with string keys).
 */
export function isScValRecord(value: ScValParsed): value is ScValRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array) &&
    !(value instanceof Map)
  );
}

/**
 * Check if a parsed value is a Map.
 */
export function isScValMap(value: ScValParsed): value is ScValMap {
  return value instanceof Map;
}

/**
 * Check if a parsed value looks like a union (vec starting with a symbol).
 * Returns the tag and values if it is, undefined otherwise.
 * @internal
 */
export function asUnion(
  value: ScValParsed,
): { tag: string; values: ScValParsed[] } | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const [first, ...rest] = value;
  if (typeof first === "string") {
    return { tag: first, values: rest };
  }

  return undefined;
}

/**
 * Parse multiple ScVals (e.g., event topics).
 */
/** @internal */
export function parseScVals(scvs: xdr.ScVal[]): ScValParsed[] {
  return scvs.map(parseScVal);
}
