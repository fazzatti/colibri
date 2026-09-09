import { Spec } from "stellar-sdk/contract";
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
    for (
      const suffix of [
        "",
        "Methods",
        "Spec",
        "Errors",
        "Provenance",
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
    const methods = renderMethods(spec, model, className);
    const events = renderEvents(spec, model, className);
    const sdk = options.target === "npm"
      ? "@stellar/stellar-sdk/contract"
      : "stellar-sdk/contract";
    const prefix = options.output === "package" ? "generated/" : "";
    return {
      files: {
        [`${prefix}constants.ts`]: renderConstants(
          spec,
          className,
          sdk,
          options,
        ),
        [`${prefix}types.ts`]: renderTypes(
          className,
          sdk,
          model.declarations(),
          methods,
          events,
        ),
        [`${prefix}index.ts`]: renderClient(className, sdk),
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
