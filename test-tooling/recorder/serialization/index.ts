import type { Evidence, RecorderOptions } from "@/recorder/types.ts";

function scalar(item: unknown, stringLength: number): Evidence {
  if (typeof item === "string") {
    return item.length > stringLength
      ? item.slice(0, stringLength) + "…[truncated]"
      : item;
  }
  if (typeof item === "bigint") return item.toString();
  if (typeof item === "boolean") return item;
  if (typeof item === "number") {
    return Number.isFinite(item) ? item : String(item);
  }
  return `[${typeof item}]`;
}

const sensitive =
  /(?:secret|private|seed|password|token|signer|credential|signature|authorization|xdr)/i;
/** Bounded snapshots without evaluating getters or recursively traversing SDK clients. */
export function snapshot(
  value: unknown,
  options: RecorderOptions = {},
): Evidence {
  const seen = new WeakSet<object>();
  const { depth = 8, entries = 100, stringLength = 4096 } = options.limits ??
    {};
  const visit = (item: unknown, level: number): Evidence => {
    if (item === null || item === undefined) return null;
    if (typeof item !== "object") return scalar(item, stringLength);
    if (seen.has(item)) return "[circular]";
    if (level >= depth) return "[depth limit]";
    seen.add(item);
    if (item instanceof Uint8Array) return `[bytes: ${item.byteLength}]`;
    if (Array.isArray(item)) {
      const values = item.slice(0, entries).map((v) => visit(v, level + 1));
      if (item.length > entries) {
        values.push(`[${item.length - entries} entries omitted]`);
      }
      return values;
    }
    if (item instanceof Error) {
      return {
        name: item.name,
        message: visit(item.message, level + 1),
        ...fields(item, level),
      };
    }
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== null && prototype !== Object.prototype) {
      return "[class instance]";
    }
    return fields(item, level);
  };
  const fields = (item: object, level: number): Record<string, Evidence> => {
    const result: Record<string, Evidence> = Object.create(null);
    const descriptors = Object.entries(Object.getOwnPropertyDescriptors(item));
    for (const [key, descriptor] of descriptors.slice(0, entries)) {
      result[key] = sensitive.test(key)
        ? "[redacted]"
        : "value" in descriptor
        ? visit(descriptor.value, level + 1)
        : "[accessor]";
    }
    if (descriptors.length > entries) {
      result["[truncated]"] = descriptors.length - entries;
    }
    return result;
  };
  return visit(value, 0);
}
