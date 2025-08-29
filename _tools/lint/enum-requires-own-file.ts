// deno-lint-ignore-file no-explicit-any
const THRESHOLD = 50; // enums with >50 members must be alone in their file

function isIgnorableTopLevel(stmt: any): boolean {
  const t = stmt.type;
  return t === "ImportDeclaration" || t === "ExportAllDeclaration";
}

const plugin: Deno.lint.Plugin = {
  name: "colibri-custom-rules",
  rules: {
    "enum-requires-own-file": {
      create(context) {
        return {
          TSEnumDeclaration(node) {
            // Try to access the source code directly
            const sourceCode = context.sourceCode;
            const text = sourceCode.getText(node);

            // Count members by parsing the text
            const memberMatches = text.match(
              /^\s*[A-Z_][A-Z0-9_]*\s*(=.*?)?,?\s*$/gim
            );
            const memberCount = memberMatches ? memberMatches.length : 0;

            if (memberCount <= THRESHOLD) return;

            const program = sourceCode.ast;

            // Check if there are other non-enum exports or declarations
            const offenders = program.body.filter((stmt: any) => {
              if (isIgnorableTopLevel(stmt)) return false;

              // Check if this is an export containing our enum
              if (
                stmt.type === "ExportNamedDeclaration" ||
                stmt.type === "ExportDefaultDeclaration"
              ) {
                // If it's the export containing our enum, don't count it as an offender
                if (stmt.declaration === node) return false;
                // If it's another export (like export const), it's an offender
                return true;
              }

              // Any other non-import statement is an offender
              return true;
            });

            if (offenders.length > 0) {
              const enumName = node.id?.name || "Enum";
              const otherDeclarations = offenders.length;

              context.report({
                node: node.id || node, // Report on just the enum name, not the entire body
                message: `${enumName} has ${memberCount} members (>${THRESHOLD} threshold). Large enums must be the only top-level declaration in their file. Found ${otherDeclarations} other declaration(s).`,
              });
            }
          },
        };
      },
    },
  },
};

export default plugin;
