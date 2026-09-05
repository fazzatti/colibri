import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { inspectErrorBoundaries } from "colibri-tools/error-boundaries.ts";

describe("error boundary inventory", () => {
  it("finds assertion factories, thrown constructors, and passthrough boundaries without counting comments", () => {
    const boundaries = inspectErrorBoundaries(
      "example.ts",
      `// throw new Error('not code');
assert(value, new MissingValue(input));
try { run(); } catch (cause) { throw cause; }
throw new InvalidValue(input);
try { read(); } catch { throw previous; }`,
    );
    assertEquals(
      boundaries.map(({ kind, expression, line }) => ({
        kind,
        expression,
        line,
      })),
      [
        { kind: "construct", expression: "MissingValue", line: 2 },
        { kind: "catch", expression: "cause", line: 3 },
        { kind: "throw", expression: "cause", line: 3 },
        { kind: "throw", expression: "new InvalidValue(input)", line: 4 },
        { kind: "construct", expression: "InvalidValue", line: 4 },
        { kind: "catch", expression: "<no binding>", line: 5 },
        { kind: "throw", expression: "previous", line: 5 },
      ],
    );
  });
});
