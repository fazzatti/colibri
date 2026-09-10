/** Rewrite only module specifiers in emitted declarations, preserving their types. */
import ts from "npm:typescript@5.9.3";

export function rewriteImports(
  source: string,
  resolve: (specifier: string) => string,
): string {
  const file = ts.createSourceFile(
    "module.d.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const edits: { start: number; end: number; text: string }[] = [];
  function visit(node: ts.Node): void {
    if (ts.isStringLiteral(node)) {
      const parent = node.parent;
      if (
        (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
          parent.moduleSpecifier === node ||
        ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent) &&
          parent.parent.argument === parent
      ) {
        edits.push({
          start: node.getStart(file),
          end: node.end,
          text: JSON.stringify(resolve(node.text)),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const edit of edits.reverse()) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  return source;
}
