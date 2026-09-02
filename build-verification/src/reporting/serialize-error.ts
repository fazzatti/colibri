import type { ColibriError } from "@colibri/core";
import type { JsonValue } from "@/core/policy/types.ts";

const MAXIMUM_JSON_DEPTH = 32;
const CIRCULAR_VALUE = "[Circular]";
const MAXIMUM_DEPTH_VALUE = "[Maximum serialization depth exceeded]";
const UNREADABLE_VALUE = "[Unreadable value]";

const objectType = (value: object): string => {
  try {
    const name = value.constructor?.name;
    return typeof name === "string" && name ? name : "Object";
  } catch {
    return "Object";
  }
};

const bigintValue = (value: bigint): JsonValue => ({
  type: "bigint",
  value: value.toString(),
});

const errorCause = (error: Error): JsonValue => {
  const value: Record<string, JsonValue> = {
    name: error.name,
    message: error.message,
  };
  try {
    const code = Reflect.get(error, "code");
    if (typeof code === "string" || typeof code === "number") {
      value.code = code;
    }
  } catch {
    // The stable name and message remain sufficient when a custom getter fails.
  }
  return value;
};

const unknownCause = (value: unknown): JsonValue | undefined => {
  if (value === undefined) return undefined;
  if (
    value === null || typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") return bigintValue(value);
  if (typeof value === "symbol") {
    return { type: "symbol", value: String(value) };
  }
  if (typeof value === "function") {
    return { type: "function", name: value.name || "anonymous" };
  }
  if (value instanceof Error) return errorCause(value);
  return { type: objectType(value) };
};

const UNHANDLED_JSON_VALUE = Symbol("unhandled-json-value");

const primitiveJsonValue = (
  value: unknown,
): JsonValue | undefined | typeof UNHANDLED_JSON_VALUE => {
  if (
    value === undefined || typeof value === "function" ||
    typeof value === "symbol"
  ) return undefined;
  if (
    value === null || typeof value === "string" || typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") return bigintValue(value);
  if (value instanceof Error) return errorCause(value);
  return UNHANDLED_JSON_VALUE;
};

const specialObjectJsonValue = (
  value: object,
  ancestors: WeakSet<object>,
  depth: number,
): JsonValue | typeof UNHANDLED_JSON_VALUE => {
  if (depth >= MAXIMUM_JSON_DEPTH) return MAXIMUM_DEPTH_VALUE;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return { type: objectType(value), byteLength: value.byteLength };
  }
  if (ancestors.has(value)) return CIRCULAR_VALUE;
  return UNHANDLED_JSON_VALUE;
};

const objectEntriesJsonValue = (
  value: object,
  ancestors: WeakSet<object>,
  depth: number,
): JsonValue => {
  if (Array.isArray(value)) {
    return value.map((entry) => jsonValue(entry, ancestors, depth + 1) ?? null);
  }
  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    return UNREADABLE_VALUE;
  }
  const output: Record<string, JsonValue> = Object.create(null);
  for (const key of keys) {
    let entry: unknown;
    try {
      entry = Reflect.get(value, key);
    } catch {
      output[key] = UNREADABLE_VALUE;
      continue;
    }
    const normalized = jsonValue(entry, ancestors, depth + 1, key === "cause");
    if (normalized !== undefined) output[key] = normalized;
  }
  return output;
};

const jsonValue = (
  value: unknown,
  ancestors: WeakSet<object>,
  depth: number,
  isCause = false,
): JsonValue | undefined => {
  if (isCause) return unknownCause(value);
  const primitive = primitiveJsonValue(value);
  if (primitive !== UNHANDLED_JSON_VALUE) return primitive;

  const object = value as object;
  const special = specialObjectJsonValue(object, ancestors, depth);
  if (special !== UNHANDLED_JSON_VALUE) return special;

  ancestors.add(object);
  try {
    return objectEntriesJsonValue(object, ancestors, depth);
  } finally {
    ancestors.delete(object);
  }
};

/** Creates a JSON-safe snapshot without mutating an error's diagnostic cause. */
export const serializeBuildVerificationError = (
  error: ColibriError,
): Readonly<Record<string, JsonValue>> => {
  let snapshot: unknown;
  try {
    snapshot = error.toJSON();
  } catch {
    snapshot = {
      name: error.name,
      domain: error.domain,
      code: error.code,
      message: error.message,
      source: error.source,
      details: error.details,
      diagnostic: error.diagnostic,
      meta: error.meta,
    };
  }
  const normalized = jsonValue(snapshot, new WeakSet(), 0);
  if (
    normalized && typeof normalized === "object" &&
    !Array.isArray(normalized)
  ) {
    return normalized as Readonly<Record<string, JsonValue>>;
  }
  return {
    name: error.name,
    domain: error.domain,
    code: error.code,
    message: error.message,
    source: error.source,
  };
};
