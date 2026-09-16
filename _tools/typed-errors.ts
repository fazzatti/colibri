/** Workspace error architecture, derived from source declarations rather than a package allowlist. */
import ts from "npm:typescript@5.9.3";
import { dirname, normalize, resolve } from "node:path";
export interface ErrorSource {
  path: string;
  text: string;
  aliasRoot: string;
}
export interface ErrorArchitecture {
  errors: string[];
  codes: number;
  concreteClasses: number;
}
/** Enforce one concrete subclass per owned stable code and prohibit generic construction at call sites. */
export function inspectTypedErrors(inputs: ErrorSource[]): ErrorArchitecture {
  const files = new Map(inputs.map((input) => [normalize(input.path), {
    ...input,
    ast: ts.createSourceFile(
      input.path,
      input.text,
      ts.ScriptTarget.Latest,
      true,
    ),
  }]));
  const codes = new Map<string, string>();
  const classes = new Map<
    string,
    { codes: Set<string>; node: ts.ClassDeclaration; path: string }
  >();
  const imports = new Map<string, Map<string, string>>();
  const key = (path: string, name: string) => `${normalize(path)}#${name}`;
  const errors: string[] = [];
  for (const file of files.values()) {
    const imported = new Map<string, string>();
    imports.set(file.path, imported);
    for (const node of file.ast.statements) {
      if (
        ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const spec = node.moduleSpecifier.text;
        const path = spec.startsWith("@/")
          ? resolve(file.aliasRoot, spec.slice(2))
          : spec.startsWith(".")
          ? resolve(dirname(file.path), spec)
          : undefined;
        const bindings = node.importClause?.namedBindings;
        if (path && bindings && ts.isNamedImports(bindings)) {
          for (const item of bindings.elements) {
            imported.set(
              item.name.text,
              key(path, (item.propertyName ?? item.name).text),
            );
          }
        }
        if (path && bindings && ts.isNamespaceImport(bindings)) {
          imported.set(bindings.name.text, key(path, ""));
        }
      }
      if (ts.isEnumDeclaration(node) && /Code$/.test(node.name.text)) {
        for (const member of node.members) {
          if (member.initializer && ts.isStringLiteral(member.initializer)) {
            codes.set(
              key(
                file.path,
                `${node.name.text}.${member.name.getText(file.ast)}`,
              ),
              member.initializer.text,
            );
          }
        }
      }
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (!/Code$/.test(decl.name.getText(file.ast))) {
            continue;
          }
          let value = decl.initializer;
          if (value && ts.isAsExpression(value)) value = value.expression;
          if (value && ts.isObjectLiteralExpression(value)) {
            for (const member of value.properties) {
              if (
                ts.isPropertyAssignment(member) &&
                ts.isStringLiteral(member.initializer)
              ) {
                codes.set(
                  key(
                    file.path,
                    `${decl.name.getText(file.ast)}.${
                      member.name.getText(file.ast)
                    }`,
                  ),
                  member.initializer.text,
                );
              }
            }
          }
        }
      }
      if (ts.isClassDeclaration(node) && node.name && node.heritageClauses) {
        classes.set(key(file.path, node.name.text), {
          codes: new Set(),
          node,
          path: file.path,
        });
      }
    }
  }
  function reference(path: string, expression: string): string {
    const [head, ...tail] = expression.split(".");
    const imported = imports.get(path)?.get(head);
    return imported
      ? imported + (imported.endsWith("#") ? "" : tail.length ? "." : "") +
        tail.join(".")
      : key(path, expression);
  }
  const errorClasses = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, cls] of classes) {
      const bases = cls.node.heritageClauses?.flatMap((h) =>
        h.types.map((t) =>
          t.expression.getText()
        )
      ) ?? [];
      if (
        !errorClasses.has(id) &&
        bases.some((base) =>
          /Error$/.test(base) || errorClasses.has(reference(cls.path, base))
        )
      ) {
        errorClasses.add(id);
        changed = true;
      }
    }
  }
  const owners = new Map<string, string[]>();
  for (const [id, cls] of classes) {
    const ast = files.get(cls.path)!.ast;
    function visit(n: ts.Node): void {
      if (ts.isPropertyAccessExpression(n)) {
        const ref = reference(cls.path, n.getText(ast));
        if (codes.has(ref)) cls.codes.add(ref);
      }
      ts.forEachChild(n, visit);
    }
    // Only runtime members: the generic base's type parameter is not a fixed code.
    function runtime(n: ts.Node): void {
      if (
        ts.isCallExpression(n) &&
        n.expression.kind === ts.SyntaxKind.SuperKeyword
      ) n.arguments.forEach(visit);
      if (
        ts.isPropertyDeclaration(n) && n.name.getText(ast) === "code" &&
        n.initializer
      ) visit(n.initializer);
      ts.forEachChild(n, runtime);
    }
    cls.node.members.forEach(runtime);
    if (cls.codes.size > 1) {
      errors.push(
        `${id}: an error class cannot represent multiple stable codes`,
      );
    }
    for (const code of cls.codes) {
      owners.set(code, [...(owners.get(code) ?? []), id]);
    }
  }
  for (const [id, code] of codes) {
    const found = owners.get(id) ?? [];
    if (found.length !== 1) {
      errors.push(
        `${id} (${code}): expected one concrete class, found ${found.length}`,
      );
    }
  }
  for (const file of files.values()) {
    const values = new Map<string, ts.Expression>();
    function collect(n: ts.Node): void {
      if (
        ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
      ) values.set(n.name.text, n.initializer);
      ts.forEachChild(n, collect);
    }
    collect(file.ast);
    function hasCode(n: ts.Expression, seen = new Set<string>()): boolean {
      if (ts.isIdentifier(n) && !seen.has(n.text)) {
        const value = values.get(n.text);
        return value ? hasCode(value, new Set([...seen, n.text])) : false;
      }
      return ts.isObjectLiteralExpression(n) &&
        n.properties.some((p) =>
          (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
            p.name.getText(file.ast) === "code" ||
          ts.isSpreadAssignment(p) && hasCode(p.expression, seen)
        );
    }
    function visit(n: ts.Node): void {
      if (ts.isNewExpression(n)) {
        const ref = reference(file.path, n.expression.getText(file.ast));
        const cls = classes.get(ref);
        // ColibriError itself is the intentionally extensible consumer base. Its
        // own implementation handles custom consumer codes and GEN_000 dispatch.
        const extensionBoundary = cls?.node.name?.text === "ColibriError" &&
          cls.path === file.path;
        if (
          cls && errorClasses.has(ref) && cls.codes.size !== 1 &&
          !extensionBoundary
        ) {
          errors.push(
            `${file.path}:${
              file.ast.getLineAndCharacterOfPosition(n.getStart()).line + 1
            }: instantiate a concrete error, not ${
              n.expression.getText(file.ast)
            }`,
          );
        }
      }
      if (
        ts.isCallExpression(n) &&
        /\.unexpected$|\.fromUnknown$/.test(n.expression.getText(file.ast))
      ) {
        for (const arg of n.arguments) {
          if (hasCode(arg)) {
            errors.push(
              `${file.path}: fixed-code generic error factory; construct its dedicated subclass`,
            );
          }
        }
      }
      ts.forEachChild(n, visit);
    }
    visit(file.ast);
  }
  return {
    errors,
    codes: codes.size,
    concreteClasses:
      [...classes.values()].filter((c) => c.codes.size === 1).length,
  };
}
