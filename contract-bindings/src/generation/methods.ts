import type { Spec } from "@colibri/core";
import { BindingError, Code } from "@/error.ts";
import {
  doc,
  indent,
  property,
  type TypeMap,
  typeName,
} from "@/generation/type-map.ts";

/** @internal Constructors run during deployment, outside ordinary contract calls. */
export function callableMethods(spec: Spec): ReturnType<Spec["funcs"]> {
  return spec.funcs().filter((method) =>
    method.name.toString() !== "__constructor"
  );
}

/** @internal Render named function inputs/outputs and their correlated method map. */
export function renderMethods(
  spec: Spec,
  model: TypeMap,
  className: string,
): string {
  const methods = spec.funcs();
  const seen = new Set<string>();
  const declarations: string[] = [];
  const entries: string[] = [];
  for (const method of methods) {
    const name = method.name.toString();
    if (seen.has(name)) {
      throw new BindingError(Code.INVALID_SPEC, `Duplicate function ${name}`);
    }
    seen.add(name);
    if (method.outputs.length > 1) {
      throw new BindingError(
        Code.INVALID_SPEC,
        "The Stellar SDK does not support multiple function outputs",
      );
    }
    if (
      new Set(method.inputs.map((field) => field.name.toString())).size !==
        method.inputs.length
    ) {
      throw new BindingError(Code.INVALID_SPEC, `Duplicate inputs in ${name}`);
    }
    const input = `${typeName(name)}Input`;
    const output = `${typeName(name)}Output`;
    model.claim(input);
    if (name === "__constructor") {
      declarations.push(
        `${
          doc(
            method.doc.toString(),
            "Arguments passed to __constructor during deployment.",
          )
        }
export type ${input} = ${model.fields(method.inputs, "Input")};`,
      );
      continue;
    }
    model.claim(output);
    let result = method.outputs[0]
      ? model.type(method.outputs[0], "Output", true)
      : "null";
    if (
      `export type ${output} = ${result};`.length > 80 &&
      result.startsWith("StellarResult<")
    ) {
      result = result.replace("StellarResult<", "StellarResult<\n  ").replace(
        ", { message: string }>",
        ",\n  { message: string }\n>",
      );
    }
    declarations.push(`${doc(method.doc.toString(), `Arguments for ${name}.`)}
export type ${input} = ${model.fields(method.inputs, "Input")};

/** Decoded return value of ${name}. */
export type ${output} = ${result};`);
    entries.push(`${property(name)}: {
  input: ${input};
  output: ${output};
};`);
  }
  return `${declarations.join("\n\n")}

/** Callable ABI methods available through read and invoke; excludes __constructor. */
export type ${className}MethodMap = {
${indent(entries.join("\n"))}
};`;
}
