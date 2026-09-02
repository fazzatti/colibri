import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import plugin from "colibri-tools/lint/no-relative-imports.ts";

const diagnosticsFor = (source: string): Deno.lint.Diagnostic[] =>
  Deno.lint.runPlugin(plugin, "fixture.ts", source);

describe("no-relative-imports lint rule", () => {
  it("rejects static imports and re-exports with relative specifiers", () => {
    const diagnostics = diagnosticsFor(`
      import value from "./value.ts";
      import type { Value } from "../types.ts";
      export { helper } from "./helper.ts";
      export * from "../index.ts";
    `);

    assertEquals(
      diagnostics.map((diagnostic) => diagnostic.id),
      Array(4).fill("colibri-import-rules/no-relative-imports"),
    );
  });

  it("rejects dynamic and type imports with static relative specifiers", () => {
    const diagnostics = diagnosticsFor(`
      const module = await import("./module.ts");
      const templateModule = await import(\`../template.ts\`);
      type Module = import("../module.ts").Module;
      import Legacy = require("./legacy.ts");
    `);

    assertEquals(diagnostics.length, 4);
  });

  it("allows aliases, package imports, URLs, and computed dynamic imports", () => {
    const diagnostics = diagnosticsFor(`
      import value from "@/value.ts";
      import type { Value } from "@colibri/core";
      export * from "jsr:@std/assert";
      export const local = 1;
      const remote = await import("https://example.com/module.ts");
      const computed = await import(moduleSpecifier);
      const computedTemplate = await import(\`\${moduleRoot}/module.ts\`);
    `);

    assertEquals(diagnostics, []);
  });
});
