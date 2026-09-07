import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { generateDocumentation } from "./documentation.ts";
import { normalizeDeclaration } from "./api-model.ts";

async function fixture(
  run: (root: string, file: string) => Promise<void>,
): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "colibri-declarations-" });
  const file = `${root}/types.ts`;
  try {
    await Deno.writeTextFile(
      file,
      "export type BaseFee = `${number}`;\n" +
        "export type ContractId = `C${string}`;\n" +
        'export type Literal = "\\u001b[31m";\n',
    );
    await run(root, file);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

describe("deterministic declaration generation", () => {
  it("preserves template types and actual escape characters in literal types", async () => {
    await fixture(async (root, file) => {
      const data = JSON.parse(await generateDocumentation(root, file));
      const node = data.nodes[Object.keys(data.nodes)[0]];
      assertEquals(
        node.symbols.map((symbol: { declarations: { def: unknown }[] }) =>
          symbol.declarations[0].def
        ),
        [
          {
            tsType: {
              repr: "${number}",
              kind: "literal",
              value: {
                kind: "template",
                tsTypes: [
                  { kind: "literal", value: { kind: "string", string: "" } },
                  { repr: "number", kind: "keyword", value: "number" },
                  { kind: "literal", value: { kind: "string", string: "" } },
                ],
              },
            },
          },
          {
            tsType: {
              repr: "C${string}",
              kind: "literal",
              value: {
                kind: "template",
                tsTypes: [
                  {
                    repr: "C",
                    kind: "literal",
                    value: { kind: "string", string: "C" },
                  },
                  { repr: "string", kind: "keyword", value: "string" },
                  { kind: "literal", value: { kind: "string", string: "" } },
                ],
              },
            },
          },
          {
            tsType: {
              repr: "\u001b[31m",
              kind: "literal",
              value: { kind: "string", string: "\u001b[31m" },
            },
          },
        ],
      );
    });
  });

  it("produces the same declarations with inherited color enabled or disabled", async () => {
    await fixture(async (root, file) => {
      const expected = normalizeDeclaration(
        JSON.parse(await generateDocumentation(root, file)),
      );
      const module = new URL("./documentation.ts", import.meta.url).href;
      const script = `import { generateDocumentation } from ${
        JSON.stringify(module)
      }; console.log(await generateDocumentation(${JSON.stringify(root)}, ${
        JSON.stringify(file)
      }));`;
      const environments: Record<string, string>[] = [
        {},
        { FORCE_COLOR: "1" },
        { FORCE_COLOR: "0" },
        { NO_COLOR: "1" },
        { FORCE_COLOR: "1", NO_COLOR: "1" },
      ];
      for (const color of environments) {
        const output = await new Deno.Command(Deno.execPath(), {
          cwd: root,
          args: ["eval", "--no-config", script],
          clearEnv: true,
          env: { DENO_DIR: `${root}/cache`, ...color },
        }).output();
        assertEquals(
          output.success,
          true,
          new TextDecoder().decode(output.stderr),
        );
        assertEquals(
          normalizeDeclaration(
            JSON.parse(new TextDecoder().decode(output.stdout)),
          ),
          expected,
        );
      }
    });
  });

  it("identifies real documentation command failures", async () => {
    await fixture(async (root, file) => {
      await Deno.remove(file);
      await assertRejects(
        () => generateDocumentation(root, file),
        Error,
        `API_DOC_FAILED: ${file}`,
      );
    });
  });
});
