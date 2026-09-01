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
  switch (scv.type) {
    // Void
    case "scvVoid":
      return null;

    // Boolean
    case "scvBool":
      return scv.b;

    // Integers - small (fit in number)
    case "scvU32":
      return scv.u32;

    case "scvI32":
      return scv.i32;

    // Integers - large (use bigint)
    case "scvU64":
    case "scvI64":
    case "scvU128":
    case "scvI128":
    case "scvU256":
    case "scvI256":
      return scValToBigInt(scv);

    // Timepoint and Duration (also bigint)
    case "scvTimepoint":
      return scv.timepoint;

    case "scvDuration":
      return scv.duration;

    // Strings
    case "scvSymbol":
      return scv.sym.asStringOrBytes();

    case "scvString":
      return scv.str.asStringOrBytes();

    case "scvExecutableTag":
      return scv.executableTag.asStringOrBytes();

    // Bytes
    case "scvBytes":
      return Uint8Array.from(scv.bytes.toBytes());

    // Address - convert to strkey string
    case "scvAddress":
      return Address.fromScVal(scv).toString();

    // Vec (also used for tuples and union values)
    case "scvVec": {
      const vec = scv.vec ?? [];
      return vec.map(parseScVal);
    }

    // Map (also used for structs)
    case "scvMap": {
      const entries = scv.map ?? [];
      return parseScValMap(entries);
    }

    // Error
    case "scvError": {
      const err = scv.error;
      return {
        type: err.type,
        code: err.type === "sceContract" ? err.contractCode : err.code.value,
      } as ScValRecord;
    }

    // Contract instance
    case "scvContractInstance": {
      const instance = scv.instance;
      return {
        executable: instance.executable.type,
      } as ScValRecord;
    }

    // Ledger key types - these are rarely seen in events, return basic info
    case "scvLedgerKeyContractInstance":
      return { ledgerKeyType: "contractInstance" } as ScValRecord;

    case "scvLedgerKeyNonce":
      return { ledgerKeyType: "nonce" } as ScValRecord;

    default:
      throw new UNSUPPORTED_SCVAL_TYPE((scv as { type: string }).type);
  }
}

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
  switch (scv.type) {
    case "scvVoid":
      return "void";
    case "scvBool":
      return "bool";
    case "scvU32":
      return "u32";
    case "scvI32":
      return "i32";
    case "scvU64":
      return "u64";
    case "scvI64":
      return "i64";
    case "scvU128":
      return "u128";
    case "scvI128":
      return "i128";
    case "scvU256":
      return "u256";
    case "scvI256":
      return "i256";
    case "scvTimepoint":
      return "timepoint";
    case "scvDuration":
      return "duration";
    case "scvSymbol":
      return "symbol";
    case "scvString":
      return "string";
    case "scvExecutableTag":
      return "executableTag";
    case "scvBytes":
      return "bytes";
    case "scvAddress":
      return "address";
    case "scvVec":
      return "vec";
    case "scvMap":
      return "map";
    case "scvError":
      return "error";
    case "scvContractInstance":
      return "contractInstance";
    case "scvLedgerKeyContractInstance":
      return "ledgerKeyContractInstance";
    case "scvLedgerKeyNonce":
      return "ledgerKeyNonce";
    default:
      throw new UNKNOWN_SCVAL_TYPE((scv as { type: string }).type);
  }
}

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
