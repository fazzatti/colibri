import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type {
  EventSchema,
  FieldTypeFor,
  TopicFilterArgs,
} from "@/event/types.ts";

type TypesEqual<Left, Right> = (<Type>() => Type extends Left ? 1 : 2) extends
  (<Type>() => Type extends Right ? 1 : 2) ? true
  : false;

const AlternateTopicSchema = {
  name: "alternate_topic",
  topics: [{
    name: "scope",
    type: "string",
    alternateTypes: ["map"],
  }],
  value: { name: "enabled", type: "bool" },
} as const satisfies EventSchema;

describe("event schema types", () => {
  it("includes alternate representations only in parsed accessor types", () => {
    const accessorIncludesAlternate: TypesEqual<
      FieldTypeFor<typeof AlternateTopicSchema, "scope">,
      string | Record<string, unknown> | Map<unknown, unknown>
    > = true;
    const topicFilterUsesPrimaryType: TypesEqual<
      TopicFilterArgs<typeof AlternateTopicSchema>["scope"],
      string | undefined
    > = true;

    assertEquals(accessorIncludesAlternate, true);
    assertEquals(topicFilterUsesPrimaryType, true);
  });
});
