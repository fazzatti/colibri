import type * as xdr from "stellar-sdk/xdr";
import { requireValue } from "@/soroban-types/error.ts";

// Compare decoded XDR fields, not serialized bytes: length prefixes and signed
// integer encodings do not have Soroban's content-wise ordering (CAP-46-01).
function compareWire(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  if (typeof left === "object" && typeof right === "object") {
    const a = Object.values(left!);
    const b = Object.values(right!);
    for (let index = 0; index < Math.min(a.length, b.length); index++) {
      const compared = compareWire(a[index], b[index]);
      if (compared) return compared;
    }
    return a.length - b.length;
  }
  return (left as number | bigint) < (right as number | bigint) ? -1 : 1;
}

/** @internal Total ordering over decoded XDR discriminants and fields. */
export function compareScVals(left: xdr.ScVal, right: xdr.ScVal): number {
  return compareWire(left.toXdrObject(), right.toXdrObject());
}

/** @internal Sorts a copy into contract map order, rejecting duplicate keys. */
export function canonicalMap(
  entries: readonly xdr.ScMapEntry[],
): xdr.ScMapEntry[] {
  const sorted = [...entries].sort((a, b) => compareScVals(a.key, b.key));
  requireOrderedMap(sorted);
  return sorted;
}

/** @internal Rejects wire maps the host would reject, including duplicate keys. */
export function requireOrderedMap(entries: readonly xdr.ScMapEntry[]): void {
  for (let index = 1; index < entries.length; index++) {
    requireValue(
      compareScVals(entries[index - 1].key, entries[index].key) < 0,
      "map",
      "keys must be strictly increasing, without duplicates",
    );
  }
}
