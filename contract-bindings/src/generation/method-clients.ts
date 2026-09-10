import { Contract, type Spec } from "@colibri/core";
import {
  doc,
  indent,
  property,
  quote,
  typeName,
} from "@/generation/type-map.ts";

/** @internal A direct client property and the exact ABI method it calls. */
export type MethodBinding = {
  method: ReturnType<Spec["funcs"]>[number];
  name: string;
  property: string;
};

/** @internal Instance fields do not appear on Contract.prototype. */
const INSTANCE_MEMBERS = [
  "rpc",
  "networkConfig",
  "readPipe",
  "invokePipe",
  "spec",
  "wasm",
  "wasmHash",
  "contractId",
  "externalRef",
  "loadedSnapshot",
  "eventRegistry",
  "eventSpec",
  // Some runtimes omit this legacy accessor; reserve it for portable output.
  "__proto__",
  "then",
  "toJSON",
];

/** @internal Preserve ABI spelling without replacing Contract members or object hooks. */
export function methodBindings(spec: Spec): MethodBinding[] {
  const reserved = new Set(INSTANCE_MEMBERS);
  for (
    let prototype = Contract.prototype;
    prototype !== null;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      reserved.add(name);
    }
  }
  const methods = spec.funcs();
  const occupied = new Set([
    ...reserved,
    ...methods.map((m) => m.name.toString()),
  ]);
  return methods.map((method) => {
    const name = method.name.toString();
    let member = name;
    if (reserved.has(member)) {
      do member += "Method"; while (occupied.has(member));
    }
    occupied.add(member);
    return { method, name, property: member };
  });
}

/** @internal Typed arrows retain this client when a read/invoke helper is detached. */
export function renderMethodClient(
  binding: MethodBinding,
  client: string,
): string {
  const { method, name, property: member } = binding;
  const methodId = `ContractMethods.${typeName(name)}`;
  return indent(`${doc(method.doc.toString(), `Simulate or invoke ${name}.`)}
readonly ${property(member)}: ${client}Method<${quote(name)}> = {
  read: (methodArgs) =>
    this.read({ method: ${methodId}, methodArgs }),
  invoke: (args) =>
    this.invoke({
      ...args,
      method: ${methodId},
    }),
};`);
}
