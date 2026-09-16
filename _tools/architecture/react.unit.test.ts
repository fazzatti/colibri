import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { fileURLToPath } from "node:url";
import {
  checkReactClientDirectives,
  clientDirectivePosition,
} from "colibri-tools/react-client-directives.ts";

const root = new URL("../../react/", import.meta.url);

describe("React package context boundaries", () => {
  it("recognizes comments but rejects imports before a client directive", () => {
    assertEquals(
      clientDirectivePosition('/* comment */ "use client"; import "react";'),
      0,
    );
    assertEquals(
      clientDirectivePosition('import type { X } from "react"; "use client";'),
      1,
    );
    assertEquals(clientDirectivePosition('import "react"; "use client";'), 1);
    assertEquals(clientDirectivePosition('const label = "use client";'), -1);
  });
  it("keeps every client directive before all imports, including type imports", async () => {
    await checkReactClientDirectives(fileURLToPath(new URL("src/", root)));
  });
  it("rejects removed or displaced directives in emitted ESM", async () => {
    const temporary = await Deno.makeTempDir({ prefix: "client-directives-" });
    const source = `${temporary}/source`;
    const output = `${temporary}/output`;
    try {
      await Deno.mkdir(`${source}/nested`, { recursive: true });
      await Deno.mkdir(`${output}/nested`, { recursive: true });
      await Deno.writeTextFile(
        `${source}/nested/hook.ts`,
        '"use client"; export const hook = 1;',
      );
      await Deno.writeTextFile(`${source}/data.ts`, "export const data = 1;");
      await Deno.writeTextFile(
        `${source}/ignored.test.ts`,
        'import "react"; "use client";',
      );
      await Deno.writeTextFile(
        `${output}/nested/hook.js`,
        '/* emitted */ "use client"; export const hook = 1;',
      );
      await checkReactClientDirectives(source, output);
      for (
        const invalid of [
          "export const hook = 1;",
          'import "react"; "use client";',
        ]
      ) {
        await Deno.writeTextFile(`${output}/nested/hook.js`, invalid);
        await assertRejects(
          () => checkReactClientDirectives(source, output),
          Error,
          "CLIENT_DIRECTIVE_EMIT",
        );
      }
      await Deno.writeTextFile(
        `${source}/nested/hook.ts`,
        'import type { X } from "react"; "use client";',
      );
      await assertRejects(
        () => checkReactClientDirectives(source),
        Error,
        "CLIENT_DIRECTIVE_ORDER",
      );
    } finally {
      await Deno.remove(temporary, { recursive: true });
    }
  });
  it("keeps mod.ts as the only root TypeScript module", async () => {
    const modules: string[] = [];
    for await (const entry of Deno.readDir(root)) {
      if (entry.isFile && /\.tsx?$/.test(entry.name)) modules.push(entry.name);
    }
    assertEquals(modules.sort(), ["mod.ts"]);
  });

  it("groups source files into context directories", async () => {
    for await (const entry of Deno.readDir(new URL("src/", root))) {
      assert(
        entry.isDirectory,
        `Place ${entry.name} inside its feature context`,
      );
    }
  });

  it("publishes subpaths from their context entrypoints", async () => {
    const manifest = JSON.parse(
      await Deno.readTextFile(new URL("deno.json", root)),
    );
    assertEquals(manifest.exports["."], "./mod.ts");
    for (const [name, path] of Object.entries(manifest.exports)) {
      if (name === ".") continue;
      assert(
        typeof path === "string" && /^\.\/src\/.+\/index\.ts$/.test(path),
        `${name} must point to a context entrypoint under src`,
      );
    }
  });
});
