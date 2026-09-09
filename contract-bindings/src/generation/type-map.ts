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
  scSpecTypeVal: "Val",
  scSpecTypeBool: "Bool",
  scSpecTypeVoid: "Void",
  scSpecTypeError: "Error",
  scSpecTypeU32: "U32",
  scSpecTypeI32: "I32",
  scSpecTypeU64: "U64",
  scSpecTypeI64: "I64",
  scSpecTypeU128: "U128",
  scSpecTypeI128: "I128",
  scSpecTypeU256: "U256",
  scSpecTypeI256: "I256",
  scSpecTypeTimepoint: "Timepoint",
  scSpecTypeDuration: "Duration",
  scSpecTypeBytes: "Bytes",
  scSpecTypeString: "String",
  scSpecTypeSymbol: "Symbol",
  scSpecTypeAddress: "Address",
  scSpecTypeMuxedAddress: "MuxedAddress",
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
  readonly imports = new Set<string>();
  readonly names = new Map<string, string>();
  readonly aliases = new Map<xdr.ScSpecEntry, string>();
  readonly inputNames = new Map<string, string>();
  readonly inputVariants = new Set<string>();
  readonly warnings: string[] = [];
  private readonly referencedTypes = new Set<string>();
  private readonly claimed = new Set([
    "SorobanType",
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
    "ContractErrorMap",
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
    for (const [entry, alias] of this.aliases) {
      if (
        entry.type === "scSpecEntryUdtStructV0" ||
        entry.type === "scSpecEntryUdtUnionV0" ||
        entry.type === "scSpecEntryUdtEnumV0"
      ) this.inputVariants.add(alias);
    }
    const methodNames = new Set(
      spec.funcs().flatMap((
        method,
      ) => [
        typeName(method.name.toString()) + "Input",
        typeName(method.name.toString()) + "Output",
      ]),
    );
    for (const alias of this.inputVariants) {
      const candidate = `${alias}Input`;
      const name = methodNames.has(candidate) || this.claimed.has(candidate)
        ? `${alias}ValueInput`
        : candidate;
      this.claim(name);
      this.inputNames.set(alias, name);
    }
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
  private imported(name: string): string {
    this.imports.add(name);
    return name;
  }
  type(
    type: xdr.ScSpecTypeDef,
    direction: Direction,
    functionResult = false,
  ): string {
    if (SIMPLE[type.type]) {
      this.imported("SorobanType");
      return `SorobanType.${direction === "Input" ? "Input." : ""}${
        SIMPLE[type.type]
      }`;
    }
    this.imported("SorobanType");
    switch (type.type) {
      case "scSpecTypeBytesN":
        return direction === "Input"
          ? `SorobanType.Input.BytesN<${type.value.n}>`
          : `SorobanType.BytesN<${type.value.n}>`;
      case "scSpecTypeOption":
        return this.option(type.value.valueType, direction);
      case "scSpecTypeVec":
        return this.vector(type.value.elementType, direction);
      case "scSpecTypeTuple":
        return this.tuple(type.value.valueTypes, direction);
      case "scSpecTypeMap":
        return this.map(type.value.keyType, type.value.valueType, direction);
      case "scSpecTypeUdt":
        return this.userType(type.value.name.toString(), direction);
      case "scSpecTypeResult":
        return this.result(
          type.value.okType,
          type.value.errorType,
          direction,
          functionResult,
        );
      default:
        throw new BindingError(
          Code.INVALID_SPEC,
          `Unsupported native SDK type ${type.type}`,
        );
    }
  }
  private option(type: xdr.ScSpecTypeDef, direction: Direction): string {
    return direction === "Input"
      ? `SorobanType.Input.Option<${this.type(type, direction)}, ${
        this.type(type, "Output")
      }>`
      : `SorobanType.Option<${this.type(type, direction)}>`;
  }
  private vector(type: xdr.ScSpecTypeDef, direction: Direction): string {
    return direction === "Input"
      ? `SorobanType.Input.Vec<${this.type(type, direction)}, ${
        this.type(type, "Output")
      }>`
      : `SorobanType.Vec<${this.type(type, direction)}>`;
  }
  private tuple(
    types: readonly xdr.ScSpecTypeDef[],
    direction: Direction,
  ): string {
    const tuple = `[${
      types.map((item) => this.type(item, direction)).join(", ")
    }]`;
    return direction === "Input"
      ? `SorobanType.Input.Tuple<${tuple}, [${
        types.map((item) => this.type(item, "Output")).join(", ")
      }]>`
      : `SorobanType.Tuple<${tuple}>`;
  }
  private map(
    key: xdr.ScSpecTypeDef,
    value: xdr.ScSpecTypeDef,
    direction: Direction,
  ): string {
    return direction === "Input"
      ? `SorobanType.Input.Map<${this.type(key, direction)}, ${
        this.type(value, direction)
      }, ${this.type(key, "Output")}, ${this.type(value, "Output")}>`
      : `SorobanType.Map<${this.type(key, direction)}, ${
        this.type(value, direction)
      }>`;
  }
  private result(
    ok: xdr.ScSpecTypeDef,
    error: xdr.ScSpecTypeDef,
    direction: Direction,
    functionResult: boolean,
  ): string {
    if (functionResult && direction === "Output") {
      return `StellarResult<${this.type(ok, direction)}, { message: string }>`;
    }
    return direction === "Input"
      ? `SorobanType.Input.Result<${this.type(ok, direction)}, ${
        this.type(error, direction)
      }, ${this.type(ok, "Output")}, ${this.type(error, "Output")}>`
      : `SorobanType.Result<${this.type(ok, direction)}, ${
        this.type(error, direction)
      }>`;
  }
  private userType(wireName: string, direction: Direction): string {
    const name = this.names.get(wireName);
    if (!name) {
      throw new BindingError(
        Code.INVALID_SPEC,
        `Unknown user type ${wireName}`,
      );
    }
    this.referencedTypes.add(name);
    if (direction === "Output") return name;
    return this.inputVariants.has(name)
      ? this.inputNames.get(name)!
      : `SorobanType.Input.Value<${name}>`;
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
  private schema(entry: xdr.ScSpecEntry): string {
    if (entry.type === "scSpecEntryUdtStructV0") {
      if (
        entry.value.fields.some((field) => /^\d+$/.test(field.name.toString()))
      ) {
        return `{
  kind: "tuple";
  fields: [${
          entry.value.fields.map((field) => this.type(field.type, "Output"))
            .join(", ")
        }];
}`;
      }
      return `{
  kind: "struct";
  fields: ${indent(this.fields(entry.value.fields, "Output")).trimStart()};
}`;
    }
    if (entry.type === "scSpecEntryUdtUnionV0") {
      const cases = entry.value.cases.map((item) => {
        const name = item.value.name.toString();
        if (["type", "from", "fromScVal", "fromXdr"].includes(name)) {
          throw new BindingError(
            Code.INVALID_SPEC,
            `Enum variant conflicts with factory member ${name}`,
          );
        }
        const payload = item.type === "scSpecUdtUnionCaseTupleV0"
          ? `[${
            item.value.type.map((type) => this.type(type, "Output")).join(", ")
          }]`
          : "SorobanType.Void";
        return `${
          item.value.doc.toString()
            ? doc(item.value.doc.toString(), "") + "\n"
            : ""
        }${property(name)}: ${payload};`;
      });
      return `{
  kind: "enum";
  encoding: "tagged";
  variants: {
${indent(cases.join("\n"), 4)}
  };
}`;
    }
    if (entry.type === "scSpecEntryUdtEnumV0") {
      const cases = entry.value.cases.map((item) => {
        if (
          ["type", "from", "fromScVal", "fromXdr"].includes(
            item.name.toString(),
          )
        ) {
          throw new BindingError(
            Code.INVALID_SPEC,
            `Enum variant conflicts with factory member ${item.name}`,
          );
        }
        return `${
          item.doc.toString() ? doc(item.doc.toString(), "") + "\n" : ""
        }${property(item.name.toString())}: ${item.value};`;
      });
      return `{
  kind: "enum";
  encoding: "u32";
  variants: {
${indent(cases.join("\n"), 4)}
  };
}`;
    }
    throw new BindingError(Code.INVALID_SPEC, "Expected a custom declaration");
  }
  declarations(className: string): string {
    const declarations = [...this.aliases].flatMap(([entry, name]) => {
      if (entry.type === "scSpecEntryUdtErrorEnumV0") return [];
      this.imported("SorobanType");
      const schema = this.schema(entry);
      return `${
        doc(
          entry.value.doc.toString(),
          `The ${entry.value.name} type declared by the contract.`,
        )
      }
export type ${name} = SorobanType.Custom<${schema}>;

/** Raw or validated inputs derived from the ${name} declaration. */
export type ${this.inputNames.get(name)} = SorobanType.Input.Custom<${name}>;

/** Validate, encode and decode ${name} using its contract declaration. */
export const ${name}: SorobanType.Factory<${name}> = SorobanType
  .Custom.fromSpec<${name}>(
    () => ${className}Spec,
    ${quote(entry.value.name.toString())},
  );`;
    });
    const errors = [...this.aliases].flatMap(([entry, name]) => {
      if (
        entry.type !== "scSpecEntryUdtErrorEnumV0" ||
        !this.referencedTypes.has(name)
      ) return [];
      this.imported("SorobanType");
      this.imported(`${className}Errors`);
      return `${doc(entry.value.doc.toString(), `Codes declared by ${name}.`)}
export type ${name} = SorobanType.ErrorCode<typeof ${className}Errors, ${
        quote(entry.value.name.toString())
      }>;`;
    });
    return [...errors, ...declarations].join("\n\n");
  }
}
