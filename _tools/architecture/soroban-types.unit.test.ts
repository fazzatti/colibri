import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { dirname, resolve } from "node:path";
import ts from "npm:typescript@5.9.3";

const core = resolve("core");
const source = resolve(core, "soroban-types");

async function files(directory: string): Promise<string[]> {
  const result: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory) result.push(...await files(path));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      result.push(path);
    }
  }
  return result;
}

/** Type-only references between a value and its codec create no runtime cycle. */
function runtimeImports(path: string, text: string): string[] {
  const emitted = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      verbatimModuleSyntax: true,
    },
  }).outputText;
  const parsed = ts.createSourceFile(
    path,
    emitted,
    ts.ScriptTarget.Latest,
    true,
  );
  return parsed.statements.flatMap((statement) => {
    if (
      !(ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) return [];
    const name = statement.moduleSpecifier.text;
    if (name.startsWith("@/")) return [resolve(core, name.slice(2))];
    return name.startsWith(".") ? [resolve(dirname(path), name)] : [];
  });
}

describe("Soroban type module boundaries", () => {
  it("documents an explicit index entrypoint for every pillar", async () => {
    const directories = new Set((await files(source)).map(dirname));
    directories.add(resolve(core, "contract/encoding"));
    for (const directory of directories) {
      const index = await Deno.readTextFile(resolve(directory, "index.ts"));
      assert(
        index.startsWith("/**"),
        `${directory} needs module documentation`,
      );
      assert(
        index.slice(0, index.indexOf("*/")).includes("@module"),
        directory,
      );
      assert(
        !/^export \* from /m.test(index),
        `${directory} needs explicit exports`,
      );
    }
  });

  it("has no runtime cycles or dependencies on contract orchestration", async () => {
    const graph = new Map<string, string[]>();
    for (const path of await files(source)) {
      const dependencies = runtimeImports(path, await Deno.readTextFile(path));
      for (const dependency of dependencies) {
        const relative = dependency.slice(core.length + 1);
        assert(
          !/^(contract|pipelines|processes|steps|plugins)\//.test(relative),
          `${path} must not initialize ${relative}`,
        );
      }
      graph.set(path, dependencies);
    }
    const completed = new Set<string>();
    function visit(path: string, ancestors: string[]): void {
      assertEquals(
        ancestors.includes(path),
        false,
        [...ancestors, path].join(" -> "),
      );
      if (completed.has(path)) return;
      for (const dependency of graph.get(path) ?? []) {
        if (graph.has(dependency)) visit(dependency, [...ancestors, path]);
      }
      completed.add(path);
    }
    for (const path of graph.keys()) visit(path, []);
  });
});
