import { GENERATED_MARKER } from "@/generation/constants.ts";

/** @internal The public method maps and client configuration remain easy to inspect. */
export function renderTypes(
  className: string,
  declarations: string,
  methods: string,
  events: string,
): string {
  return `${GENERATED_MARKER}
/**
 * ${className} contract types, function arguments, results, and events.
 * @module
 */
import type {
  Contract,
  ContractConstructorArgs,
  ContractEventDefinition,
  ContractEventRegistry,
  KnownContractErrorMap,
} from "@colibri/core";${
    methods.includes("StellarResult") || declarations.includes("StellarResult")
      ? `\nimport type { Result as StellarResult } from "@colibri/core";`
      : ""
  }
${declarations ? declarations + "\n\n" : ""}${methods}

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

/** Configure the contract and prepare error messages before construction. */
export type ${className}ConstructorArgs = ContractConstructorArgs & {
  errors?: KnownContractErrorMap | false;
};

${events}
`;
}
