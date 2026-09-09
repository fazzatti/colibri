import { Spec } from "@colibri/core";
import type { GenerateBindingsOptions, GeneratedBindings } from "@/types.ts";
import { BindingError, Code } from "@/error.ts";
import { identifier, TypeMap } from "@/generation/type-map.ts";
import { renderMethods } from "@/generation/methods.ts";
import { renderEvents } from "@/generation/events.ts";
export { GENERATED_MARKER } from "@/generation/constants.ts";
import { renderConstants } from "@/generation/constants.ts";
import { renderTypes } from "@/generation/types.ts";
import { renderClient } from "@/generation/client.ts";
import { packageScaffold } from "@/generation/scaffold.ts";

/** Renders constants, named ABI types, a client, and setup guidance without I/O. */
export function generateBindings(
  input: Spec,
  options: GenerateBindingsOptions = {},
): GeneratedBindings {
  try {
    const className = options.className ?? "ContractClient";
    validateOptions(options, className);
    const spec = new Spec(input.entries.map((entry) => entry.toXdr("base64")));
    const model = new TypeMap(spec);
    model.claim("ContractMethods");
    for (
      const suffix of [
        "",
        "Spec",
        "Errors",
        "MethodMap",
        "Inputs",
        "Outputs",
        "Call",
        "Invocation",
        "InvocationResult",
        "ConstructorArgs",
        "Events",
      ]
    ) {
      model.claim(className + suffix);
    }
    if (options.provenance) model.claim(`${className}Provenance`);
    const methods = renderMethods(spec, model, className);
    const events = renderEvents(spec, model, className);
    const prefix = options.output === "package" ? "generated/" : "";
    return {
      files: {
        [`${prefix}constants.ts`]: renderConstants(
          spec,
          className,
          options,
        ),
        [`${prefix}types.ts`]: renderTypes(
          className,
          model.declarations(className),
          methods,
          events,
          model.imports,
        ),
        [`${prefix}index.ts`]: renderClient(className),
      },
      scaffold: packageScaffold(options, className, spec),
      warnings: [
        ...model.warnings,
        ...(spec.events().length ? [] : [
          "No event declarations in this spec. The contract may still emit events.",
        ]),
      ],
    };
  } catch (cause) {
    if (cause instanceof BindingError) throw cause;
    throw new BindingError(
      Code.INVALID_SPEC,
      "Could not generate bindings from this spec",
      cause,
    );
  }
}

function validateOptions(
  options: GenerateBindingsOptions,
  className: string,
): void {
  if (
    !identifier(className) ||
    ["Contract", "ColibriError", "Spec", "createContractErrorMatcherPlugin"]
      .includes(className)
  ) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      "Choose a valid class name that does not shadow a runtime import",
    );
  }
  if (
    options.target !== undefined && !["jsr", "npm"].includes(options.target)
  ) throw new BindingError(Code.INVALID_OPTIONS, "Unknown target preset");
  if (
    options.output !== undefined &&
    !["files", "package"].includes(options.output)
  ) throw new BindingError(Code.INVALID_OPTIONS, "Unknown output mode");
}
