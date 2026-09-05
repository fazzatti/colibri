import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

type Fixture = {
  write(path: string, text: string): Promise<void>;
  run(...args: string[]): Promise<{ code: number; output: string }>;
  format(): Promise<void>;
};

// Exercise the real command against disposable source/docs trees. These are
// parser inputs, not mocks of the checker, the TypeScript compiler, or GitBook.
async function withFixture(check: (fixture: Fixture) => Promise<void>) {
  const root = await Deno.makeTempDir({ prefix: "colibri-documentation-" });
  const write = async (path: string, text: string) => {
    const target = `${root}/${path}`;
    await Deno.mkdir(target.slice(0, target.lastIndexOf("/")), {
      recursive: true,
    });
    await Deno.writeTextFile(target, text);
  };
  const run = async (...args: string[]) => {
    const output = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--no-config",
        "--allow-read",
        "--allow-write",
        "--allow-env",
        "--allow-run",
        `${root}/_tools/documentation.ts`,
        ...args,
      ],
      cwd: root,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const decoder = new TextDecoder();
    return {
      code: output.code,
      output: decoder.decode(output.stdout) + decoder.decode(output.stderr),
    };
  };
  try {
    await write(
      "_tools/package-inventory.ts",
      await Deno.readTextFile(
        new URL(import.meta.resolve("colibri-tools/package-inventory.ts")),
      ),
    );
    await write(
      "_tools/documentation.ts",
      await Deno.readTextFile(
        new URL(import.meta.resolve("colibri-tools/documentation.ts")),
      ),
    );
    await write("deno.json", JSON.stringify({ workspace: ["./core"] }));
    await write(
      "core/deno.json",
      JSON.stringify({
        name: "@colibri/core",
        version: "1.0.0",
        exports: "./mod.ts",
      }),
    );
    await write("core/mod.ts", "export const example = true;\n");
    await write(
      "core/error.ts",
      'export enum Code { INVALID = "EXAMPLE_001" }\n',
    );
    await write(
      "docs/README.md",
      "# Introduction\n\n<!-- deno-check -->\n```ts\nconst value: number = 1;\n```\n",
    );
    await write(
      "docs/getting-started/installation.md",
      "# Installation\n\njsr:@colibri/core@^1.0.0\n",
    );
    await write("docs/core/error.md", "# Error handling\n");
    await write(
      "docs/reference/README.md",
      "# API\n\n[API](https://jsr.io/@colibri/core/doc)\n",
    );
    await write(
      "docs/SUMMARY.md",
      [
        "# Contents",
        "",
        "- [Start](README.md)",
        "- [Installation](getting-started/installation.md)",
        "- [Errors](core/error.md)",
        "- [API](reference/README.md)",
        "<!-- error-contexts:start -->",
        "<!-- error-contexts:end -->",
        "",
      ].join("\n"),
    );
    const generated = await run("--write");
    assertEquals(generated.code, 0, generated.output);
    await check({
      write,
      run,
      format: async () => {
        const result = await new Deno.Command(Deno.execPath(), {
          args: ["fmt", "--no-config", `${root}/docs`],
          stdout: "null",
          stderr: "piped",
        }).output();
        assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
      },
    });
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

describe("GitBook documentation validation", () => {
  it("accepts Deno-formatted generated tables without weakening content checks", async () => {
    await withFixture(async ({ format, run }) => {
      await format();
      const result = await run();
      assertEquals(result.code, 0, result.output);
    });
  });

  it("generates references and type-checks a complete example", async () => {
    await withFixture(async ({ run }) => {
      const result = await run("--examples");
      assertEquals(result.code, 0, result.output);
      assertStringIncludes(
        result.output,
        "1 declared error codes in 1 contexts",
      );
      assertStringIncludes(
        result.output,
        "1 complete documentation examples type-checked",
      );
    });
  });

  it("rejects stale error definitions until regeneration", async () => {
    await withFixture(async ({ write, run }) => {
      await write(
        "core/error.ts",
        'export enum Code { INVALID = "EXAMPLE_002" }\n',
      );
      const result = await run();
      assertEquals(result.code, 1);
      assertStringIncludes(result.output, "Stale error reference");
      const regenerated = await run("--write");
      assertEquals(regenerated.code, 0, regenerated.output);
    });
  });

  it("rejects broken files, headings, and links outside GitBook", async () => {
    await withFixture(async ({ write, run }) => {
      await write(
        "docs/README.md",
        "# Start\n\n[Missing](missing.md)\n[Heading](core/error.md#missing)\n[Outside](../core/mod.ts)\n",
      );
      const result = await run();
      assertEquals(result.code, 1);
      for (
        const message of [
          "Broken link:",
          "Broken heading link:",
          "Link leaves GitBook:",
        ]
      ) {
        assertStringIncludes(result.output, message);
      }
    });
  });

  it("rejects pages missing from navigation", async () => {
    await withFixture(async ({ write, run }) => {
      await write("docs/new-guide.md", "# A new guide\n");
      const result = await run();
      assertEquals(result.code, 1);
      assertStringIncludes(
        result.output,
        "Page absent from SUMMARY.md: new-guide.md",
      );
    });
  });

  it("rejects stale installation versions and missing package API links", async () => {
    await withFixture(async ({ write, run }) => {
      await write(
        "docs/getting-started/installation.md",
        "# Install\n\njsr:@colibri/core@^0.9.0\n",
      );
      await write("docs/reference/README.md", "# API\n");
      const result = await run();
      assertEquals(result.code, 1);
      assertStringIncludes(
        result.output,
        "Installation example does not match",
      );
      assertStringIncludes(result.output, "Missing API reference");
    });
  });

  it("rejects syntax errors even in unmarked fragments", async () => {
    await withFixture(async ({ write, run }) => {
      await write(
        "docs/README.md",
        "# Start\n\n```ts\nconst broken = ;\n```\n",
      );
      const result = await run();
      assertEquals(result.code, 1);
      assertStringIncludes(result.output, "Invalid TypeScript snippet");
    });
  });

  it("rejects type errors in marked complete examples", async () => {
    await withFixture(async ({ write, run }) => {
      await write(
        "docs/README.md",
        "# Start\n\n<!-- deno-check -->\n```ts\nconst value: number = 'not a number';\n```\n",
      );
      const result = await run("--examples");
      assertEquals(result.code, 1);
      assertStringIncludes(
        result.output,
        "Documentation examples do not type-check",
      );
    });
  });
});
