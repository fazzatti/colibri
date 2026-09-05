/** Repository-only syntax inventory; a rethrow is not automatically a domain violation. */
import ts from "npm:typescript@5.9.3";
import { relative, resolve } from "node:path";
import { readPackageInventory } from "./package-inventory.ts";

export type ErrorBoundary = {
  file: string;
  line: number;
  kind: "construct" | "throw" | "catch";
  expression: string;
};

/** Includes each constructor, throw and catch, not merely named error declarations. */
export function inspectErrorBoundaries(
  file: string,
  text: string,
): ErrorBoundary[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const result: ErrorBoundary[] = [];
  const visit = (node: ts.Node): void => {
    const kind = ts.isThrowStatement(node)
      ? "throw"
      : ts.isCatchClause(node)
      ? "catch"
      : ts.isNewExpression(node)
      ? "construct"
      : undefined;
    if (kind) {
      const expression = ts.isNewExpression(node)
        ? node.expression
        : ts.isThrowStatement(node)
        ? node.expression
        : ts.isCatchClause(node)
        ? node.variableDeclaration
        : undefined;
      result.push({
        file,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        kind,
        expression: expression?.getText(source) ?? "<no binding>",
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

async function inventory(
  directory: string,
  root: string,
): Promise<ErrorBoundary[]> {
  const results: ErrorBoundary[] = [];
  for await (const entry of Deno.readDir(directory)) {
    if (["node_modules", ".git", "coverage"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory) results.push(...await inventory(path, root));
    else if (
      entry.isFile && entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts")
    ) {
      results.push(
        ...inspectErrorBoundaries(
          relative(root, path),
          await Deno.readTextFile(path),
        ),
      );
    }
  }
  return results;
}

if (import.meta.main) {
  const root = resolve(import.meta.dirname!, "..");
  const packages = await readPackageInventory(root);
  const boundaries = (await Promise.all(packages.map((pkg) =>
    inventory(resolve(root, pkg.root), root)
  ))).flat()
    .sort((a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line
    );
  console.log(JSON.stringify(
    {
      note:
        "Syntax inventory for review. Constructors include assertions and error factories as well as non-error objects; catches/rethrows may preserve caller-owned failures. Stable error codes are documented separately under docs/reference/errors.",
      packages: packages.map((pkg) => pkg.name),
      boundaries,
    },
    null,
    2,
  ));
}
