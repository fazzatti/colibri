import { GENERATED_MARKER } from "@/generation/constants.ts";

/** @internal A focused Contract subclass; constants and ABI types live in their own files. */
export function renderClient(name: string): string {
  return `${GENERATED_MARKER}
/**
 * Typed Colibri client for ${name}.
 * @module
 */
import {
  Contract,
  type ContractId,
  createContractErrorMatcherPlugin,
} from "@colibri/core";
import { Spec } from "@colibri/core";
import { ${name}Errors, ${name}Spec } from "./constants.ts";
import type {
  ${name}Call,
  ${name}ConstructorArgs,
  ${name}Events,
  ${name}Invocation,
  ${name}InvocationResult,
  ${name}MethodMap,
  ${name}Outputs,
} from "./types.ts";

export * from "./constants.ts";
export * from "./types.ts";

/** Simulate or invoke any function declared in the embedded contract spec. */
export class ${name} extends Contract {
  /** Install a fresh spec and the prepared error map alongside existing plugins. */
  constructor({ errors = ${name}Errors, ...args }: ${name}ConstructorArgs) {
    const contractId = args.contractConfig.contractId as ContractId | undefined;
    const matcher = errors === false || Object.keys(errors).length === 0
      ? undefined
      : createContractErrorMatcherPlugin(
        contractId ? [{ strategy: "contract-id", contractId, errors }] : [{
          strategy: "issued-from",
          issuedFrom: "root-invocation",
          errors,
        }],
      );
    const plugins = args.contractConfig.plugins;

    super({
      ...args,
      contractConfig: {
        ...args.contractConfig,
        spec: new Spec(${name}Spec.entries.map((entry) => entry.toXdr("base64"))),
        plugins: {
          invokePipe: [
            ...(matcher ? [matcher] : []),
            ...(plugins?.invokePipe ?? []),
          ],
          readPipe: [
            ...(matcher ? [matcher] : []),
            ...(plugins?.readPipe ?? []),
          ],
        },
      },
    });
  }

  /** Access event definitions bound to the current contract ID. */
  override get events(): ${name}Events {
    return super.events as ${name}Events;
  }

  /** Simulate a function and decode its result without submitting a transaction. */
  override async read<Method extends keyof ${name}MethodMap>(
    args: ${name}Call<Method>,
  ): Promise<${name}Outputs[Method]> {
    return await super.read(args) as ${name}Outputs[Method];
  }

  /** Submit through Colibri and retain both the decoded value and raw result. */
  override async invoke<Method extends keyof ${name}MethodMap>(
    args: ${name}Call<Method> & ${name}Invocation,
  ): Promise<${name}InvocationResult<${name}Outputs[Method]>> {
    const result = await super.invoke(args);
    return this.decodeInvocationResult<${name}Outputs[Method]>(
      args.method,
      result,
    );
  }
}
`;
}
