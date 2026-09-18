import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  consumerFiles,
  copyConsumerFixtures,
  installedFixture,
} from "colibri-tools/consumers/fixtures.ts";

const packages = { "@colibri/core": "@jsr/colibri__core" };

describe("installed consumer fixtures", () => {
  it("rewrites imports, exports, import types and dynamic imports at package boundaries", () => {
    const source = [
      'import { Contract } from "@colibri/core";',
      "import '@colibri/core/values';",
      'export { Contract } from "@colibri/core";',
      'export type Client = import("@colibri/core").Contract;',
      'const lazy = import("@colibri/core/values");',
      'import { xdr } from "stellar-sdk";',
      'import { Spec } from "stellar-sdk/contract";',
      'import { Pipeline } from "convee";',
      "import '@colibri/core-extra';",
      'import "stellar-sdk-extra";',
      'import "./local.ts";',
    ].join("\n");
    assertEquals(
      installedFixture(source, packages),
      [
        'import { Contract } from "@jsr/colibri__core";',
        'import "@jsr/colibri__core/values";',
        'export { Contract } from "@jsr/colibri__core";',
        'export type Client = import("@jsr/colibri__core").Contract;',
        'const lazy = import("@jsr/colibri__core/values");',
        'import { xdr } from "@stellar/stellar-sdk";',
        'import { Spec } from "@stellar/stellar-sdk/contract";',
        'import { Pipeline } from "@jsr/fifo__convee";',
        "import '@colibri/core-extra';",
        'import "stellar-sdk-extra";',
        'import "./local.ts";',
      ].join("\n"),
    );
  });

  it("preserves assertions, literal types, template text and comments exactly", () => {
    const source = [
      "const expected = 'from \"@colibri/core\"';",
      "assert(readme.includes('from \"@colibri/core\"'));",
      'type Alias = "@colibri/core";',
      'const template = `import { Contract } from "@colibri/core"`;',
      '// import { Contract } from "@colibri/core";',
      '/* export * from "@colibri/core"; */',
      'const sdk = "stellar-sdk";',
      'const plugin = "convee";',
      'const dependency = "npm:react@^19.1.1";',
      'const options = import("./local.ts", { with: { type: "@colibri/core" } });',
    ].join("\n");
    assertEquals(installedFixture(source, packages), source);
  });

  it("normalizes fixture npm dependencies without changing candidate package imports", () => {
    const dependencies = [
      ["react@^19.1.1", "react"],
      ["react-dom@^19.1.1/client", "react-dom/client"],
      ["@types/react@^19.1.13", "@types/react"],
      ["@types/react-dom@^19.1.9", "@types/react-dom"],
      ["@tanstack/react-query@^5.90.0", "@tanstack/react-query"],
      ["@stellar/freighter-api@6.0.1", "@stellar/freighter-api"],
      [
        "@creit.tech/stellar-wallets-kit@^2.0.0",
        "@creit.tech/stellar-wallets-kit",
      ],
    ];
    for (const [input, expected] of dependencies) {
      assertEquals(
        installedFixture(`import 'npm:${input}';`),
        `import "${expected}";`,
      );
    }
    const unchanged = 'import "@colibri/core"; import "npm:other@1.0.0";';
    assertEquals(installedFixture(unchanged), unchanged);
  });

  it("preserves the real bindings README assertion in copied published consumers", async () => {
    const directory = await Deno.makeTempDir();
    try {
      await copyConsumerFixtures(directory);
      for (const name of consumerFiles) {
        const source = await Deno.readTextFile(`${directory}/${name}`);
        assertStringIncludes(source, "import");
      }
      const source = await Deno.readTextFile(`${directory}/bindings-smoke.ts`);
      const installed = installedFixture(source, packages);
      assertStringIncludes(installed, 'from "@jsr/colibri__core/values"');
      assertStringIncludes(installed, "includes('from \"@colibri/core\"')");
      assertEquals(
        installed.includes("includes('from \"@jsr/colibri__core\"')"),
        false,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
