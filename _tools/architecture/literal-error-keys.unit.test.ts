import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import ts from "npm:typescript@5.9.3";
import { readdir } from "node:fs/promises";

describe("literal error registries", () => {
  it("keeps optimizable literal keys aligned with each constructor's stable Code", async () => {
    let checked = 0;
    for (const relative of await readdir("core", { recursive: true })) {
      const file = { path: `core/${relative}` };
      if (!file.path.endsWith(".ts") || file.path.endsWith(".test.ts")) {
        continue;
      }
      const source = ts.createSourceFile(
        file.path,
        await Deno.readTextFile(file.path),
        ts.ScriptTarget.Latest,
        true,
      );
      const enumeration = source.statements.find((
        node,
      ): node is ts.EnumDeclaration =>
        ts.isEnumDeclaration(node) && node.name.text === "Code"
      );
      if (!enumeration) continue;
      const codes = new Map(
        enumeration.members.flatMap((member) =>
          member.initializer && ts.isStringLiteral(member.initializer)
            ? [[member.name.getText(source), member.initializer.text]]
            : []
        ),
      );
      function visit(node: ts.Node): void {
        if (
          ts.isPropertyAssignment(node) &&
          ts.isComputedPropertyName(node.name) &&
          ts.isAsExpression(node.name.expression) &&
          ts.isStringLiteral(node.name.expression.expression)
        ) {
          const key = node.name.expression;
          assert(
            ts.isTypeReferenceNode(key.type) &&
              ts.isQualifiedName(key.type.typeName),
          );
          const type = key.type.typeName;
          assertEquals(type.left.getText(source), "Code");
          assertEquals(
            (key.expression as ts.StringLiteral).text,
            codes.get(type.right.text),
            `${file.path}: ${type.right.text}`,
          );
          checked++;
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    assert(
      checked > 300,
      `Expected to inspect the Core registries; inspected ${checked} entries`,
    );
  });
});
