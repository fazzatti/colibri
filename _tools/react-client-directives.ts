/** Validate React client boundaries in source and emitted consumer modules. */
import ts from "npm:typescript@5.9.3";
import { relative, resolve } from "node:path";

/** Index of the directive statement, or -1 when the module is not marked. */
export function clientDirectivePosition(source: string): number {
  return ts.createSourceFile("module.ts", source, ts.ScriptTarget.Latest, true)
    .statements.findIndex((statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === "use client"
    );
}

/** Check every marked module; optionally require its emitted ESM boundary too. */
export async function checkReactClientDirectives(
  sourceRoot: string,
  outputRoot?: string,
): Promise<void> {
  async function visit(directory: string): Promise<void> {
    for await (const entry of Deno.readDir(directory)) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory) await visit(path);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        const position = clientDirectivePosition(await Deno.readTextFile(path));
        if (position < 0) continue;
        if (position !== 0) throw new Error(`CLIENT_DIRECTIVE_ORDER: ${path}`);
        if (outputRoot) {
          const emitted = resolve(
            outputRoot,
            relative(sourceRoot, path).replace(/\.ts$/, ".js"),
          );
          if (clientDirectivePosition(await Deno.readTextFile(emitted)) !== 0) {
            throw new Error(`CLIENT_DIRECTIVE_EMIT: ${emitted}`);
          }
        }
      }
    }
  }
  await visit(sourceRoot);
}
