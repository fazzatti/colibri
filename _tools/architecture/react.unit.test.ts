import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

const root = new URL("../../react/", import.meta.url);

describe("React package context boundaries", () => {
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
