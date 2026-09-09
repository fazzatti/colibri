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
  scSpecTypeVal: "SorobanVal",
  scSpecTypeBool: "SorobanBool",
  scSpecTypeVoid: "SorobanVoid",
  scSpecTypeError: "SorobanError",
  scSpecTypeU32: "SorobanU32",
  scSpecTypeI32: "SorobanI32",
  scSpecTypeU64: "SorobanU64",
  scSpecTypeI64: "SorobanI64",
  scSpecTypeU128: "SorobanU128",
  scSpecTypeI128: "SorobanI128",
  scSpecTypeU256: "SorobanU256",
  scSpecTypeI256: "SorobanI256",
  scSpecTypeTimepoint: "SorobanTimepoint",
  scSpecTypeDuration: "SorobanDuration",
  scSpecTypeBytes: "SorobanBytes",
  scSpecTypeString: "SorobanString",
  scSpecTypeSymbol: "SorobanSymbol",
  scSpecTypeAddress: "SorobanAddress",
  scSpecTypeMuxedAddress: "SorobanMuxedAddress",
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
  private readonly factoryNames = new Set<string>();
  private readonly referencedTypes = new Set<string>();
  private readonly claimed = new Set([
    ...Object.values(SIMPLE).flatMap((
      name,
    ) => [name + "Input", name + "Native"]),
    "SorobanValue",
    "SorobanVecInput",
    "SorobanMapInput",
    "SorobanOptionInput",
    "SorobanResultInput",
    "SorobanResultNative",
    "SorobanBytesNInput",
    "createSorobanFactory",
    "createSorobanUnion",
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
        entry.type === "scSpecEntryUdtUnionV0"
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
      return this.imported(
        SIMPLE[type.type] + (direction === "Input" ? "Input" : "Native"),
      );
    }
    switch (type.type) {
      case "scSpecTypeBytesN":
        return direction === "Input"
          ? `${this.imported("SorobanBytesNInput")}<${type.value.n}>`
          : this.imported("SorobanBytesNative");
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
      ? `${this.imported("SorobanOptionInput")}<${
        this.type(type, direction)
      }, ${this.type(type, "Output")}>`
      : `(${this.type(type, direction)}) | null`;
  }
  private vector(type: xdr.ScSpecTypeDef, direction: Direction): string {
    return direction === "Input"
      ? `${this.imported("SorobanVecInput")}<${this.type(type, direction)}, ${
        this.type(type, "Output")
      }>`
      : `Array<${this.type(type, direction)}>`;
  }
  private tuple(
    types: readonly xdr.ScSpecTypeDef[],
    direction: Direction,
  ): string {
    const tuple = `[${
      types.map((item) => this.type(item, direction)).join(", ")
    }]`;
    return direction === "Input"
      ? `${tuple} | ${this.imported("SorobanValue")}<[${
        types.map((item) => this.type(item, "Output")).join(", ")
      }], "tuple">`
      : tuple;
  }
  private map(
    key: xdr.ScSpecTypeDef,
    value: xdr.ScSpecTypeDef,
    direction: Direction,
  ): string {
    return direction === "Input"
      ? `${this.imported("SorobanMapInput")}<${this.type(key, direction)}, ${
        this.type(value, direction)
      }, ${this.type(key, "Output")}, ${this.type(value, "Output")}>`
      : `Array<[${this.type(key, direction)}, ${this.type(value, direction)}]>`;
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
      ? `${this.imported("SorobanResultInput")}<${this.type(ok, direction)}, ${
        this.type(error, direction)
      }, ${this.type(ok, "Output")}, ${this.type(error, "Output")}>`
      : `${this.imported("SorobanResultNative")}<${this.type(ok, direction)}, ${
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
      : `${name} | ${this.imported("SorobanValue")}<${name}>`;
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
  declarations(className: string): string {
    const declarations = [...this.aliases].flatMap(([entry, name]) =>
      this.typeDeclaration(entry, name)
    );
    // Preserve ABI references without creating another runtime error registry.
    const errors = [...this.aliases].flatMap(([entry, name]) => {
      if (
        entry.type !== "scSpecEntryUdtErrorEnumV0" ||
        !this.referencedTypes.has(name)
      ) return [];
      return `${doc(entry.value.doc.toString(), `Codes declared by ${name}.`)}
export type ${name} = ${
        entry.value.cases.map((item) => item.value).join(" | ") || "never"
      };`;
    });
    const factories = [...this.aliases].flatMap(([entry, name]) => {
      if (
        entry.type === "scSpecEntryUdtErrorEnumV0" &&
        !this.referencedTypes.has(name)
      ) return [];
      const helper = entry.type === "scSpecEntryUdtUnionV0"
        ? "createSorobanUnion"
        : "createSorobanFactory";
      this.imported(helper);
      if (
        entry.type === "scSpecEntryUdtEnumV0" ||
        entry.type === "scSpecEntryUdtErrorEnumV0"
      ) {
        if (!this.factoryNames.has(name)) {
          this.claim(`${name}Type`);
          this.factoryNames.add(name);
        }
        return `/** Validate and encode the ${name} codes declared by this contract. */\n${
          this.factoryDeclaration(
            `${name}Type`,
            helper,
            [name],
            className,
            entry.value.name.toString(),
          )
        }`;
      }
      if (entry.type === "scSpecEntryUdtUnionV0") {
        for (const item of entry.value.cases) {
          if (
            ["type", "from", "fromScVal", "fromXdr"].includes(
              item.value.name.toString(),
            )
          ) {
            throw new BindingError(
              Code.INVALID_SPEC,
              `Union variant conflicts with factory member ${item.value.name}`,
            );
          }
        }
      }
      return `/** Validate, encode and decode ${name} using its contract declaration. */\n${
        this.factoryDeclaration(
          name,
          helper,
          [this.inputNames.get(name)!, name],
          className,
          entry.value.name.toString(),
        )
      }`;
    });
    return [...errors, ...declarations, ...factories].join("\n\n");
  }
  private typeDeclaration(
    entry: xdr.ScSpecEntry,
    name: string,
  ): string[] | string {
    if (entry.type === "scSpecEntryUdtErrorEnumV0") return [];
    const documentation = doc(
      entry.value.doc.toString(),
      `The ${entry.value.name} type declared by the contract.`,
    );
    if (entry.type === "scSpecEntryUdtEnumV0") {
      return `${documentation}\nexport enum ${name} {\n${
        indent(
          entry.value.cases.map((item) =>
            `${item.doc.toString() ? doc(item.doc.toString(), "") + "\n" : ""}${
              property(item.name.toString())
            } = ${item.value},`
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
        }\nexport type ${this.inputNames.get(name)} =\n${
          this.value(entry, "Input").startsWith("  |")
            ? this.value(entry, "Input")
            : "  | " + this.value(entry, "Input").replaceAll("\n", "\n  ")
        }\n  | ${this.imported("SorobanValue")}<${name}>;`,
      ]
      : [declaration];
  }
  private factoryDeclaration(
    name: string,
    helper: string,
    types: string[],
    className: string,
    wireName: string,
  ): string {
    const prefix = `export const ${name} = ${helper}<${types.join(", ")}>`;
    const args = `(() => ${className}Spec, ${quote(wireName)});`;
    if (prefix.length + args.length <= 80) return prefix + args;
    if (prefix.length > 80) {
      return `export const ${name} = ${helper}<\n  ${
        types.join(",\n  ")
      }\n>${args}`;
    }
    return `${prefix}(\n  () => ${className}Spec,\n  ${quote(wireName)},\n);`;
  }
}
