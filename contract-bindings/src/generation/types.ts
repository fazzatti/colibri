import { GENERATED_MARKER } from "@/generation/constants.ts";

/** @internal The public method maps and client configuration remain easy to inspect. */
export function renderTypes(
  className: string,
  declarations: string,
  methods: string,
  events: string,
  imports: ReadonlySet<string> = new Set(),
): string {
  const runtime = [...imports].filter((name) =>
    name.startsWith("createSoroban")
  );
  const typeImports = [...imports].filter((name) =>
    !name.startsWith("createSoroban")
  ).sort();
  const helpers = `${
    typeImports.length
      ? `\nimport type {\n  ${
        typeImports.join(",\n  ")
      },\n} from "@colibri/core";`
      : ""
  }${
    runtime.length
      ? `\nimport { ${
        runtime.sort().join(", ")
      } } from "@colibri/core";\nimport { ${className}Spec } from "./constants.ts";`
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

/** Method names mapped to their native arguments. */
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
