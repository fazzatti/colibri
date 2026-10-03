import * as xdr from "stellar-sdk/xdr";
import { requireOrderedMap } from "@/soroban-types/codecs/ordering.ts";
import { requireTag, symbolType } from "@/soroban-types/codecs/primitives.ts";
import { requireValue } from "@/soroban-types/error.ts";

/** @internal Validates an ordered, unique symbol-keyed contract record. */
export function requireSymbolRecord(value: xdr.ScVal): Map<string, xdr.ScVal> {
  requireTag(value, "scvMap");
  requireValue(value.map !== null, "record", "expected a non-null field map");
  requireOrderedMap(value.map);
  return new Map(
    value.map.map(({ key, val }) => [symbolType().decode(key), val]),
  );
}

/** @internal Selects fields by name; each caller still decodes the declared type. */
export function recordFieldValues(
  value: xdr.ScVal,
  names: readonly string[],
  policy: "evolution" | "strict" = "evolution",
): xdr.ScVal[] {
  requireValue(
    new Set(names).size === names.length,
    "record",
    "duplicate schema fields",
  );
  const fields = requireSymbolRecord(value);
  if (policy === "strict") {
    requireValue(
      fields.size === names.length && names.every((name) => fields.has(name)),
      "record",
      "fields do not match the spec",
    );
  }
  return names.map((name) => fields.get(name) ?? xdr.ScVal.scvVoid());
}
