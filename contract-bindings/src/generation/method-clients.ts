import { Contract, type Spec } from "@colibri/core";
import { callableMethods } from "@/generation/methods.ts";
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
  collision: boolean;
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

/** @internal Normalize word separators and acronym boundaries for JavaScript properties. */
export function methodName(value: string): string {
  return value.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .split(/[^A-Za-z0-9$]+/).filter(Boolean)
    .map((part, index) => {
      const word = part.toLowerCase();
      return index ? word[0].toUpperCase() + word.slice(1) : word;
    }).join("");
}

/** @internal CamelCase helpers preserve ABI dispatch and protect existing client members. */
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
  const methods = callableMethods(spec);
  const occupied = new Set([
    ...reserved,
    ...methods.map((m) => methodName(m.name.toString())),
  ]);
  const assigned = new Set(reserved);
  return methods.map((method) => {
    const name = method.name.toString();
    const preferred = methodName(name);
    let member = preferred;
    if (assigned.has(member)) {
      do member += "Method"; while (occupied.has(member));
    }
    occupied.add(member);
    assigned.add(member);
    return { method, name, property: member, collision: member !== preferred };
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
