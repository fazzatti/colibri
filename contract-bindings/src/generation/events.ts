import {
  contractEventBindings,
  extractContractEventsFromSpec,
} from "@colibri/core";
import type { Spec } from "@colibri/core";
import {
  doc,
  indent,
  property,
  type TypeMap,
  typeName,
} from "@/generation/type-map.ts";

/** @internal Named event payloads, indexed topics, and the typed registry. */
export function renderEvents(
  spec: Spec,
  model: TypeMap,
  className: string,
): string {
  extractContractEventsFromSpec(spec);
  const declarations: string[] = [];
  const entries = contractEventBindings(spec).map((binding, index) => {
    const event = spec.events()[index];
    const name = typeName(binding.key);
    const fields = name;
    const topics = `${name}Topics`;
    model.claim(fields);
    model.claim(topics);
    declarations.push(
      `${doc(event.doc.toString(), `Fields emitted by ${binding.name}.`)}
export type ${fields} = ${model.fields(event.params, "Output")};

/** Indexed fields accepted by the ${binding.name} event filters. */
export type ${topics} = ${
        model.fields(
          event.params.filter((param) =>
            param.location.name === "scSpecEventParamLocationTopicList"
          ),
          "Input",
        )
      };`,
    );
    return `readonly ${property(binding.key)}: ContractEventDefinition<
  ${fields},
  ${topics}
>;`;
  });
  return `${declarations.join("\n\n")}

/** Event definitions bound to this client, with typed decoding and filters. */
export type ${className}Events = ContractEventRegistry & {
${indent(entries.join("\n"))}
};`;
}
