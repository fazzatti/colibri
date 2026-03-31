import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { StepThis } from "convee";
import { getRequiredStepOutput } from "@/pipelines/shared/connectors/runtime.ts";
import { ColibriError } from "@/error/index.ts";

const createRuntime = (
  snapshot: { output?: unknown } | undefined,
): StepThis =>
  ({
    context: () => ({
      step: new Map(
        snapshot === undefined ? [] : [["step-id", snapshot]],
      ),
    }),
  }) as unknown as StepThis;

describe("shared runtime connector helpers", () => {
  it("returns the required step output when it exists", () => {
    const runtime = createRuntime({ output: 42 });

    const result = getRequiredStepOutput<number>(runtime, "step-id");

    assertEquals(result, 42);
  });

  it("throws when the required step output is missing", () => {
    const runtime = createRuntime(undefined);

    assertThrows(
      () => getRequiredStepOutput(runtime, "step-id"),
      ColibriError,
      "Missing required step output",
    );
  });
});
