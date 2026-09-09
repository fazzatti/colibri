import type { Spec } from "@colibri/core";
import { BindingError, Code } from "@/error.ts";
import {
  doc,
  indent,
  property,
  type TypeMap,
  typeName,
} from "@/generation/type-map.ts";

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
    model.claim(output);
    declarations.push(`${doc(method.doc.toString(), `Arguments for ${name}.`)}
export type ${input} = ${model.fields(method.inputs, "Input")};

/** Decoded return value of ${name}. */
export type ${output} = ${
      method.outputs[0] ? model.type(method.outputs[0], "Output", true) : "null"
    };`);
    entries.push(`${property(name)}: {
  input: ${input};
  output: ${output};
};`);
  }
  return `${declarations.join("\n\n")}

/** Every ABI method is available through both read and invoke. */
export type ${className}MethodMap = {
${indent(entries.join("\n"))}
};`;
}
