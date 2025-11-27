import { xdr, Address, scValToBigInt } from "stellar-sdk";
import type {
  ScValParsed,
  ScValTypeName,
  ScValRecord,
  ScValMap,
} from "@/common/scval/types.ts";

/**
 * Parse an xdr.ScVal into a TypeScript-friendly value.
 *
 * @param scv - The ScVal to parse
 * @returns The parsed TypeScript value
 * @throws Error if the ScVal type is not supported
 */
export function parseScVal(scv: xdr.ScVal): ScValParsed {
  const type = scv.switch();

  switch (type.value) {
    // Void
    case xdr.ScValType.scvVoid().value:
      return null;

    // Boolean
    case xdr.ScValType.scvBool().value:
      return scv.b();

    // Integers - small (fit in number)
    case xdr.ScValType.scvU32().value:
      return scv.u32();

    case xdr.ScValType.scvI32().value:
      return scv.i32();

    // Integers - large (use bigint)
    case xdr.ScValType.scvU64().value:
    case xdr.ScValType.scvI64().value:
    case xdr.ScValType.scvU128().value:
    case xdr.ScValType.scvI128().value:
    case xdr.ScValType.scvU256().value:
    case xdr.ScValType.scvI256().value:
      return scValToBigInt(scv);

    // Timepoint and Duration (also bigint)
    case xdr.ScValType.scvTimepoint().value:
      return scValToBigInt(xdr.ScVal.scvU64(scv.timepoint()));

    case xdr.ScValType.scvDuration().value:
      return scValToBigInt(xdr.ScVal.scvU64(scv.duration()));

    // Strings
    case xdr.ScValType.scvSymbol().value:
      return scv.sym().toString();

    case xdr.ScValType.scvString().value:
      return scv.str().toString();

    // Bytes
    case xdr.ScValType.scvBytes().value:
      return Uint8Array.from(scv.bytes());

    // Address - convert to strkey string
    case xdr.ScValType.scvAddress().value:
      return Address.fromScVal(scv).toString();

    // Vec (also used for tuples and union values)
    case xdr.ScValType.scvVec().value: {
      const vec = scv.vec() ?? [];
      return vec.map(parseScVal);
    }

    // Map (also used for structs)
    case xdr.ScValType.scvMap().value: {
      const entries = scv.map() ?? [];
      return parseScValMap(entries);
    }

    // Error
    case xdr.ScValType.scvError().value: {
      const err = scv.error();
      return {
        type: err.switch().name,
        code: err.value(),
      } as ScValRecord;
    }

    // Contract instance
    case xdr.ScValType.scvContractInstance().value: {
      const instance = scv.instance();
      return {
        executable: instance.executable().switch().name,
      } as ScValRecord;
    }

    // Ledger key types - these are rarely seen in events, return basic info
    case xdr.ScValType.scvLedgerKeyContractInstance().value:
      return { ledgerKeyType: "contractInstance" } as ScValRecord;

    case xdr.ScValType.scvLedgerKeyNonce().value:
      return { ledgerKeyType: "nonce" } as ScValRecord;

    default:
      throw new Error(`Unsupported ScVal type: ${type.name}`);
  }
}

/**
 * Parse ScMap entries into either a Record (if all keys are symbols/strings)
 * or a Map (if keys are mixed types).
 */
function parseScValMap(entries: xdr.ScMapEntry[]): ScValRecord | ScValMap {
  // Check if all keys are symbols or strings
  const allStringKeys = entries.every((entry) => {
    const keyType = entry.key().switch().value;
    return (
      keyType === xdr.ScValType.scvSymbol().value ||
      keyType === xdr.ScValType.scvString().value
    );
  });

  if (allStringKeys) {
    // Return as plain object
    const result: ScValRecord = {};
    for (const entry of entries) {
      const key = parseScVal(entry.key()) as string;
      result[key] = parseScVal(entry.val());
    }
    return result;
  }

  // Return as Map for non-string keys
  const result: ScValMap = new Map();
  for (const entry of entries) {
    result.set(parseScVal(entry.key()), parseScVal(entry.val()));
  }
  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the type name of an ScVal.
 */
export function getScValTypeName(scv: xdr.ScVal): ScValTypeName {
  const type = scv.switch();

  switch (type.value) {
    case xdr.ScValType.scvVoid().value:
      return "void";
    case xdr.ScValType.scvBool().value:
      return "bool";
    case xdr.ScValType.scvU32().value:
      return "u32";
    case xdr.ScValType.scvI32().value:
      return "i32";
    case xdr.ScValType.scvU64().value:
      return "u64";
    case xdr.ScValType.scvI64().value:
      return "i64";
    case xdr.ScValType.scvU128().value:
      return "u128";
    case xdr.ScValType.scvI128().value:
      return "i128";
    case xdr.ScValType.scvU256().value:
      return "u256";
    case xdr.ScValType.scvI256().value:
      return "i256";
    case xdr.ScValType.scvTimepoint().value:
      return "timepoint";
    case xdr.ScValType.scvDuration().value:
      return "duration";
    case xdr.ScValType.scvSymbol().value:
      return "symbol";
    case xdr.ScValType.scvString().value:
      return "string";
    case xdr.ScValType.scvBytes().value:
      return "bytes";
    case xdr.ScValType.scvAddress().value:
      return "address";
    case xdr.ScValType.scvVec().value:
      return "vec";
    case xdr.ScValType.scvMap().value:
      return "map";
    case xdr.ScValType.scvError().value:
      return "error";
    case xdr.ScValType.scvContractInstance().value:
      return "contractInstance";
    case xdr.ScValType.scvLedgerKeyContractInstance().value:
      return "ledgerKeyContractInstance";
    case xdr.ScValType.scvLedgerKeyNonce().value:
      return "ledgerKeyNonce";
    default:
      throw new Error(`Unknown ScVal type: ${type.name}`);
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
 */
export function asUnion(
  value: ScValParsed
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
export function parseScVals(scvs: xdr.ScVal[]): ScValParsed[] {
  return scvs.map(parseScVal);
}
