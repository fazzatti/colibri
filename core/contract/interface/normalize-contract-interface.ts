import type { xdr } from "stellar-sdk";
import type {
  ContractInterfaceType,
  ContractInterfaceUserType,
  ContractInterfaceUserTypeKind,
  ContractInterfaceValue,
} from "@/contract/interface/types.ts";

const OMITTED_KEYS = new Set(["doc", "lib"]);

/** @internal */
export const normalizeContractInterfaceValue = (
  value: unknown,
): ContractInterfaceValue => {
  if (
    value === null || typeof value === "string" ||
    typeof value === "number" || typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeContractInterfaceValue);
  }

  const normalized: Record<string, ContractInterfaceValue> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!OMITTED_KEYS.has(key)) {
      normalized[key] = normalizeContractInterfaceValue(child);
    }
  }
  return normalized;
};

/** @internal */
export const normalizeContractInterfaceType = (
  value: xdr.ScSpecTypeDef,
): ContractInterfaceType =>
  normalizeContractInterfaceValue(value.toJSON()) as ContractInterfaceType;

const TYPE_KIND_BY_ENTRY_KEY: Readonly<
  Record<string, ContractInterfaceUserTypeKind>
> = {
  udt_struct_v0: "struct",
  udt_union_v0: "union",
  udt_enum_v0: "enum",
  udt_error_enum_v0: "error-enum",
};

/** @internal */
export const normalizeContractUserType = (
  entry: xdr.ScSpecEntry,
): ContractInterfaceUserType | undefined => {
  const json = entry.toJSON() as Record<string, unknown>;
  const [entryKey, rawDefinition] = Object.entries(json)[0] ?? [];
  const kind = TYPE_KIND_BY_ENTRY_KEY[entryKey];
  if (!kind || typeof rawDefinition !== "object" || !rawDefinition) {
    return undefined;
  }

  const definition = normalizeContractInterfaceValue(rawDefinition);
  const name = (definition as { readonly name?: unknown }).name;
  if (typeof name !== "string") return undefined;
  return { kind, name, definition };
};
