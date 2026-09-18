/** Rewrite module specifiers in TypeScript source or declarations, preserving literals. */
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
          parent.parent.argument === parent ||
        ts.isCallExpression(parent) &&
          parent.expression.kind === ts.SyntaxKind.ImportKeyword &&
          parent.arguments[0] === node
      ) {
        const resolved = resolve(node.text);
        if (resolved === node.text) return;
        edits.push({
          start: node.getStart(file),
          end: node.end,
          text: JSON.stringify(resolved),
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
