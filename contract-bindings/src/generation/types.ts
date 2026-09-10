import { GENERATED_MARKER } from "@/generation/constants.ts";

/** @internal The public method maps and client configuration remain easy to inspect. */
export function renderTypes(
  className: string,
  declarations: string,
  methods: string,
  events: string,
  imports: ReadonlySet<string> = new Set(),
): string {
  const usesTypes = imports.has("SorobanType");
  const constants = [
    ...(declarations.includes(".fromSpec<") ? [`${className}Spec`] : []),
    ...(imports.has(`${className}Errors`) ? [`${className}Errors`] : []),
  ];
  const helpers = `${
    usesTypes ? '\nimport { SorobanType } from "@colibri/core";' : ""
  }${
    constants.length
      ? `\nimport { ${constants.join(", ")} } from "./constants.ts";`
      : ""
  }`;
  return `${GENERATED_MARKER}
/**
 * ${className} contract types, function arguments, results, and events.
 * @module
 */
import type {
  Contract,
  ContractConstructorArgs,
  ContractErrorMap,
  ContractEventDefinition,
  ContractEventRegistry,
} from "@colibri/core";${
    methods.includes("StellarResult") || declarations.includes("StellarResult")
      ? `\nimport type { Result as StellarResult } from "@colibri/core";`
      : ""
  }${helpers}

// -----------------------------------------------------------------------------
// Methods
// -----------------------------------------------------------------------------

${methods}

/** Method names mapped to their accepted arguments. */
export type ${className}Inputs = {
  [Method in keyof ${className}MethodMap]: ${className}MethodMap[Method]["input"];
};

/** Method names mapped to their decoded return values. */
export type ${className}Outputs = {
  [Method in keyof ${className}MethodMap]: ${className}MethodMap[Method]["output"];
};

/** A method and its matching arguments; argument-free calls may omit methodArgs. */
export type ${className}Call<Method extends keyof ${className}MethodMap> = {
  [Name in Method]:
    & { method: Name }
    & (
      ${className}Inputs[Name] extends Record<string, never>
        ? { methodArgs?: ${className}Inputs[Name] }
        : { methodArgs: ${className}Inputs[Name] }
    );
}[Method];

/** Transaction settings and authorization passed to Colibri. */
export type ${className}Invocation = Pick<
  Parameters<Contract["invoke"]>[0],
  "config" | "auth"
>;

/** Core transaction metadata and the decoded contract result. */
export type ${className}InvocationResult<Value> =
  & Awaited<ReturnType<Contract["invoke"]>>
  & { value: Value | undefined };

/** Bound read/invoke helpers for one ABI method, with its exact input and output. */
export type ${className}Method<Method extends keyof ${className}MethodMap> = {
  /** Simulate without submitting; argument-free methods can omit the input. */
  readonly read: (
    ...args: ${className}Inputs[Method] extends Record<string, never>
      ? [methodArgs?: ${className}Inputs[Method]]
      : [methodArgs: ${className}Inputs[Method]]
  ) => Promise<${className}Outputs[Method]>;
  /** Submit with the generic invocation object, omitting only the fixed method. */
  readonly invoke: (
    args: Omit<${className}Call<Method>, "method"> & ${className}Invocation,
  ) => Promise<${className}InvocationResult<${className}Outputs[Method]>>;
};

${
    declarations
      ? `// -----------------------------------------------------------------------------
// Contract types
// -----------------------------------------------------------------------------

${declarations}

`
      : ""
  }// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

${events.trim()}

// -----------------------------------------------------------------------------
// Client configuration
// -----------------------------------------------------------------------------

/** Configure the contract and prepare error messages before construction. */
export type ${className}ConstructorArgs = ContractConstructorArgs & {
  errors?: ContractErrorMap | false;
};
`;
}
