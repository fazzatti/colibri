const RELATIVE_IMPORT_PATTERN = /^\.\.?($|\/)/;

const reportRelativeImport = (
  context: Deno.lint.RuleContext,
  node: Deno.lint.Node,
  specifier: string,
): void => {
  if (!RELATIVE_IMPORT_PATTERN.test(specifier)) return;

  context.report({
    node,
    message:
      `Use a configured import alias instead of the relative import '${specifier}'.`,
  });
};

const plugin: Deno.lint.Plugin = {
  name: "colibri-import-rules",
  rules: {
    "no-relative-imports": {
      create(context) {
        return {
          ImportDeclaration(node) {
            reportRelativeImport(context, node.source, node.source.value);
          },
          ExportAllDeclaration(node) {
            reportRelativeImport(context, node.source, node.source.value);
          },
          ExportNamedDeclaration(node) {
            if (node.source) {
              reportRelativeImport(context, node.source, node.source.value);
            }
          },
          ImportExpression(node) {
            if (
              node.source.type === "Literal" &&
              typeof node.source.value === "string"
            ) {
              reportRelativeImport(context, node.source, node.source.value);
            } else if (
              node.source.type === "TemplateLiteral" &&
              node.source.expressions.length === 0
            ) {
              reportRelativeImport(
                context,
                node.source,
                node.source.quasis[0].cooked,
              );
            }
          },
          TSImportType(node) {
            if (
              node.argument.type === "TSLiteralType" &&
              node.argument.literal.type === "Literal" &&
              typeof node.argument.literal.value === "string"
            ) {
              reportRelativeImport(
                context,
                node.argument.literal,
                node.argument.literal.value,
              );
            }
          },
          TSExternalModuleReference(node) {
            reportRelativeImport(
              context,
              node.expression,
              node.expression.value,
            );
          },
        };
      },
    },
  },
};

export default plugin;
