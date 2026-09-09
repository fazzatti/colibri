import type { xdr } from "stellar-sdk";
import type { Spec } from "@colibri/core";
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
  const text = (value.trim() || fallback).replaceAll("*/", "* /").replaceAll(
    "\r",
    "",
  );
  if (!text.includes("\n") && text.length <= 70) return `/** ${text} */`;
  const lines = text.split("\n").flatMap((line) => {
    const words = line.trim().split(/\s+/);
    const wrapped: string[] = [""];
    for (const word of words) {
      const last = wrapped.length - 1;
      if (wrapped[last] && wrapped[last].length + word.length + 1 > 74) {
        wrapped.push(word);
      } else wrapped[last] += (wrapped[last] ? " " : "") + word;
    }
    return wrapped;
  });
  return `/**\n${
    lines.map((line) => ` *${line ? " " + line : ""}`).join("\n")
  }\n */`;
}
/** @internal */
export const quote = (value: string): string =>
  JSON.stringify(value).replaceAll("\u2028", "\\u2028").replaceAll(
    "\u2029",
    "\\u2029",
  );
export type Direction = "Input" | "Output";
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
/** @internal JavaScript type casing; ABI field names and union tags stay unchanged. */
export function typeName(value: string): string {
  const name = value.split(/[^A-Za-z0-9$]+/).filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  if (!identifier(name)) {
    throw new BindingError(
      Code.INVALID_SPEC,
      `Cannot name a TypeScript type after ${value}`,
    );
  }
  return name;
}
/** @internal Indents multiline declarations without invoking a formatter or runtime I/O. */
export const indent = (value: string, spaces = 2): string =>
  value.split("\n").map((line) => line ? " ".repeat(spaces) + line : line).join(
    "\n",
  );
/** @internal Use ordinary properties when possible, preserving all original ABI names. */
export const property = (value: string): string =>
  value === "__proto__"
    ? `[${quote(value)}]`
    : /^[A-Za-z_$][\w$]*$/.test(value)
    ? value
    : quote(value);

/** @internal Direction-aware SDK types named after the ABI declarations. */
export class TypeMap {
  readonly names = new Map<string, string>();
  readonly aliases = new Map<xdr.ScSpecEntry, string>();
  readonly inputVariants = new Set<string>();
  readonly warnings: string[] = [];
  private readonly claimed = new Set([
    "Array",
    "Map",
    "Record",
    "Uint8Array",
    "Promise",
    "Pick",
    "Parameters",
    "ReturnType",
    "Awaited",
    "Partial",
    "Contract",
    "ContractConstructorArgs",
    "ContractEventDefinition",
    "ContractEventRegistry",
    "StellarResult",
  ]);
  constructor(readonly spec: Spec) {
    for (const entry of spec.entries) {
      if (!entry.type.startsWith("scSpecEntryUdt")) continue;
      const name = entry.value.name.toString();
      if (this.names.has(name)) {
        this.warnings.push(
          `Repeated ABI type ${name}: using the first declaration, matching the Stellar SDK lookup.`,
        );
        continue;
      }
      const alias = typeName(name);
      this.claim(alias);
      this.aliases.set(entry, alias);
      this.names.set(name, alias);
    }
    // Propagate input differences through nested and recursive user types.
    let changed = true;
    while (changed) {
      changed = false;
      for (const [entry, alias] of this.aliases) {
        const types = entry.type === "scSpecEntryUdtStructV0"
          ? entry.value.fields.map((field) => field.type)
          : entry.type === "scSpecEntryUdtUnionV0"
          ? entry.value.cases.flatMap((item) =>
            item.type === "scSpecUdtUnionCaseTupleV0" ? item.value.type : []
          )
          : [];
        if (
          !this.inputVariants.has(alias) &&
          types.some((type) => this.differs(type))
        ) {
          this.inputVariants.add(alias);
          changed = true;
        }
      }
    }
    for (const alias of this.inputVariants) this.claim(`${alias}Input`);
  }
  claim(name: string): void {
    if (this.claimed.has(name)) {
      throw new BindingError(
        Code.INVALID_SPEC,
        `TypeScript name collision: ${name}. Rename the conflicting ABI declaration or client class.`,
      );
    }
    this.claimed.add(name);
  }
  private differs(type: xdr.ScSpecTypeDef): boolean {
    switch (type.type) {
      case "scSpecTypeOption":
      case "scSpecTypeMap":
        return true;
      case "scSpecTypeVec":
        return this.differs(type.value.elementType);
      case "scSpecTypeTuple":
        return type.value.valueTypes.some((item) => this.differs(item));
      case "scSpecTypeUdt":
        return this.inputVariants.has(
          this.names.get(type.value.name.toString()) ?? "",
        );
      default:
        return false;
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
      case "scSpecTypeUdt":
        return this.userType(type.value.name.toString(), direction);
      case "scSpecTypeResult":
        if (functionResult && direction === "Output") {
          return `StellarResult<${
            nested(type.value.okType)
          }, { message: string }>`;
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
  private userType(wireName: string, direction: Direction): string {
    const name = this.names.get(wireName);
    if (!name) {
      throw new BindingError(
        Code.INVALID_SPEC,
        `Unknown user type ${wireName}`,
      );
    }
    return name +
      (direction === "Input" && this.inputVariants.has(name) ? "Input" : "");
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
        indent(
          fields.map((field) =>
            [
              field.doc.toString().trim() ? doc(field.doc.toString(), "") : "",
              `${property(field.name.toString())}: ${
                this.type(field.type, direction)
              };`,
            ].filter(Boolean).join("\n")
          ).join("\n"),
        )
      }\n}`
      : "Record<string, never>";
  }
  private value(entry: xdr.ScSpecEntry, direction: Direction): string {
    if (entry.type === "scSpecEntryUdtStructV0") {
      return entry.value.fields.some((field) =>
          /^\d+$/.test(field.name.toString())
        )
        ? `[${
          entry.value.fields.map((field) => this.type(field.type, direction))
            .join(", ")
        }]`
        : this.fields(entry.value.fields, direction);
    }
    if (entry.type === "scSpecEntryUdtUnionV0") {
      return entry.value.cases.map((item) =>
        `  | {\n    tag: ${quote(item.value.name.toString())};${
          item.type === "scSpecUdtUnionCaseTupleV0"
            ? `\n    values: [${
              item.value.type.map((type) => this.type(type, direction)).join(
                ", ",
              )
            }];`
            : ""
        }\n  }`
      ).join("\n") || "never";
    }
    throw new BindingError(Code.INVALID_SPEC, "Expected a struct or union");
  }
  declarations(): string {
    return [...this.aliases].flatMap(([entry, name]) => {
      const documentation = doc(
        entry.value.doc.toString(),
        `The ${entry.value.name} type declared by the contract.`,
      );
      if (
        entry.type === "scSpecEntryUdtEnumV0" ||
        entry.type === "scSpecEntryUdtErrorEnumV0"
      ) {
        return `${documentation}\nexport enum ${name} {\n${
          indent(
            entry.value.cases.map((item) =>
              `${
                item.doc.toString() ? doc(item.doc.toString(), "") + "\n" : ""
              }${property(item.name.toString())} = ${item.value},`
            ).join("\n"),
          )
        }\n}`;
      }
      const value = this.value(entry, "Output");
      const declaration = `${documentation}\nexport type ${name} =${
        value.startsWith("  |") ? "\n" : " "
      }${value};`;
      return this.inputVariants.has(name)
        ? [
          declaration,
          `${
            doc(`Input accepted for ${name}; decoded values use ${name}.`, "")
          }\nexport type ${name}Input = ${this.value(entry, "Input")};`,
        ]
        : [declaration];
    }).join("\n\n");
  }
}
