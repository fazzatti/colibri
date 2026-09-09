import type { xdr } from "stellar-sdk";
import type { Spec } from "stellar-sdk/contract";
import { BindingError, Code } from "@/error.ts";

const RESERVED = new Set(
  "await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield implements constructor eval arguments"
    .split(" "),
);
/** @internal */
export function identifier(value: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(value) && !RESERVED.has(value);
}
/** @internal Escape untrusted ABI docs, including comment terminators. */
export function doc(value: string, fallback: string): string {
  return `/** ${
    (value.trim() || fallback).replaceAll("*/", "* /").replaceAll("\r", "")
      .replaceAll("\n", "\n * ")
  } */`;
}
/** @internal */
export const quote = (value: string): string =>
  JSON.stringify(value).replaceAll("\u2028", "\\u2028").replaceAll(
    "\u2029",
    "\\u2029",
  );
type Direction = "Input" | "Output";
const SIMPLE: Readonly<Record<string, string>> = {
  scSpecTypeVal: "unknown",
  scSpecTypeBool: "boolean",
  scSpecTypeVoid: "null",
  scSpecTypeU32: "number",
  scSpecTypeI32: "number",
  scSpecTypeU64: "bigint",
  scSpecTypeI64: "bigint",
  scSpecTypeU128: "bigint",
  scSpecTypeI128: "bigint",
  scSpecTypeU256: "bigint",
  scSpecTypeI256: "bigint",
  scSpecTypeTimepoint: "bigint",
  scSpecTypeDuration: "bigint",
  scSpecTypeBytes: "Uint8Array",
  scSpecTypeBytesN: "Uint8Array",
  scSpecTypeString: "string",
  scSpecTypeSymbol: "string",
  scSpecTypeAddress: "string",
  scSpecTypeMuxedAddress: "string",
};
/** @internal Direction-aware native codec types, with collision-safe UDT aliases. */
export class TypeMap {
  readonly names = new Map<string, string>();
  readonly aliases = new Map<xdr.ScSpecEntry, string>();
  constructor(readonly spec: Spec) {
    for (const entry of spec.entries) {
      if (!entry.type.startsWith("scSpecEntryUdt")) continue;
      const name = entry.value.name.toString();
      const alias = `Type${this.aliases.size + 1}_${
        name.replace(/[^A-Za-z0-9_$]/g, "_")
      }`;
      this.aliases.set(entry, alias);
      // Match the SDK's first-declaration lookup; preserve later declarations under distinct aliases.
      if (!this.names.has(name)) this.names.set(name, alias);
    }
  }
  type(
    type: xdr.ScSpecTypeDef,
    direction: Direction,
    functionResult = false,
  ): string {
    if (SIMPLE[type.type]) return SIMPLE[type.type];
    const nested = (type: xdr.ScSpecTypeDef) => this.type(type, direction);
    switch (type.type) {
      case "scSpecTypeOption":
        return `(${nested(type.value.valueType)}) | null${
          direction === "Input" ? " | undefined" : ""
        }`;
      case "scSpecTypeVec":
        return `Array<${nested(type.value.elementType)}>`;
      case "scSpecTypeTuple":
        return `[${type.value.valueTypes.map(nested).join(", ")}]`;
      case "scSpecTypeMap": {
        const pair = `${nested(type.value.keyType)}, ${
          nested(type.value.valueType)
        }`;
        return direction === "Input"
          ? `Map<${pair}> | Array<[${pair}]>`
          : `Array<[${pair}]>`;
      }
      case "scSpecTypeUdt": {
        const name = this.names.get(type.value.name.toString());
        if (!name) {
          throw new BindingError(
            Code.INVALID_SPEC,
            `Unknown user type ${type.value.name}`,
          );
        }
        return `${name}${direction}`;
      }
      case "scSpecTypeResult":
        if (functionResult && direction === "Output") {
          return `Result<${nested(type.value.okType)}, { message: string }>`;
        }
        throw new BindingError(
          Code.INVALID_SPEC,
          "The Stellar SDK supports Result only as a top-level function result",
        );
      default:
        throw new BindingError(
          Code.INVALID_SPEC,
          `Unsupported native SDK type ${type.type}`,
        );
    }
  }
  fields(
    fields: readonly {
      name: { toString(): string };
      doc: { toString(): string };
      type: xdr.ScSpecTypeDef;
    }[],
    direction: Direction,
  ): string {
    return fields.length
      ? `{\n${
        fields.map((field) =>
          `${doc(field.doc.toString(), "ABI field.")}\n${
            quote(field.name.toString())
          }: ${this.type(field.type, direction)};`
        ).join("\n")
      }\n}`
      : "Record<string, never>";
  }
  declarations(): string {
    return this.spec.entries.flatMap((entry) => {
      if (
        entry.type === "scSpecEntryFunctionV0" ||
        entry.type === "scSpecEntryEventV0"
      ) return [];
      return (["Input", "Output"] as const).map((direction) => {
        let value: string;
        switch (entry.type) {
          case "scSpecEntryUdtStructV0":
            value = entry.value.fields.some((field) =>
                /^\d+$/.test(field.name.toString())
              )
              ? `[${
                entry.value.fields.map((field) =>
                  this.type(field.type, direction)
                ).join(", ")
              }]`
              : this.fields(entry.value.fields, direction);
            break;
          case "scSpecEntryUdtUnionV0":
            value = entry.value.cases.map((item) =>
              `{ tag: ${quote(item.value.name.toString())}${
                item.type === "scSpecUdtUnionCaseTupleV0"
                  ? `; values: [${
                    item.value.type.map((type) => this.type(type, direction))
                      .join(", ")
                  }]`
                  : ""
              } }`
            ).join(" | ") || "never";
            break;
          default:
            value = entry.value.cases.map((item) =>
              item.value
            ).join(" | ") || "never";
        }
        return `${
          doc(entry.value.doc.toString(), "Native ABI user type.")
        }\nexport type ${this.aliases.get(entry)}${direction} = ${value};`;
      });
    }).join("\n\n");
  }
}
