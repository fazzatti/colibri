import { stub } from "@std/testing/mock";
import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { writeBindings } from "@/output/write.ts";
import { generateBindings } from "@/generation/generate.ts";
import { BindingError } from "@/error.ts";
import { bindingSpec } from "colibri-internal/tests/binding-fixtures.ts";

describe("bindings output", () => {
  it("writes replaceable files and preserves customized package scaffold", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const plan = generateBindings(bindingSpec(), {
        output: "package",
        packageName: "@example/token",
      });
      await writeBindings(plan, { directory });
      await Deno.writeTextFile(`${directory}/mod.ts`, "// my setup\n");
      await assertRejects(
        () => writeBindings(plan, { directory }),
        BindingError,
        "Already exists",
      );
      const result = await writeBindings(plan, { directory, force: true });
      assertEquals(result.written, [
        "generated/constants.ts",
        "generated/types.ts",
        "generated/colibri.ts",
        "generated/index.ts",
      ]);
      assertEquals(
        await Deno.readTextFile(`${directory}/mod.ts`),
        "// my setup\n",
      );
      await Deno.writeTextFile(
        `${directory}/generated/index.ts`,
        "// handwritten\n",
      );
      await assertRejects(
        () => writeBindings(plan, { directory, force: true }),
        BindingError,
        "handwritten",
      );
      await assertRejects(
        () =>
          writeBindings({
            files: { "../escape.ts": "bad" },
            scaffold: {},
            warnings: [],
          }, { directory }),
        BindingError,
      );
      await Deno.symlink(`${directory}/mod.ts`, `${directory}/link.ts`);
      await assertRejects(
        () =>
          writeBindings({
            files: { "link.ts": "bad" },
            scaffold: {},
            warnings: [],
          }, { directory, force: true }),
        BindingError,
        "symbolic",
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});

describe("output failure boundaries", () => {
  it("preserves filesystem access errors during preflight without writing files", async () => {
    const cause = new Deno.errors.PermissionDenied("Cannot inspect output");
    using _stat = stub(Deno, "lstat", () => Promise.reject(cause));
    const error = await assertRejects(
      () =>
        writeBindings({
          files: { "index.ts": "export {};" },
          scaffold: {},
          warnings: [],
        }, { directory: "/unavailable" }),
      BindingError,
      "Could not write",
    );
    assertEquals(error.meta?.cause, cause);
  });
  it("removes temporary files when an atomic rename fails, preserving the destination", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const plan = generateBindings(bindingSpec());
      await writeBindings(plan, { directory });
      const original = await Deno.readTextFile(`${directory}/constants.ts`);
      const cause = new Deno.errors.PermissionDenied("Destination is locked");
      using _rename = stub(Deno, "rename", () => Promise.reject(cause));
      const error = await assertRejects(
        () => writeBindings(plan, { directory, force: true }),
        BindingError,
      );
      assertEquals(error.meta?.cause, cause);
      assertEquals(
        await Deno.readTextFile(`${directory}/constants.ts`),
        original,
      );
      assertEquals(
        Array.from(Deno.readDirSync(directory)).filter((item) =>
          item.name.startsWith(".colibri-")
        ),
        [],
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("rejects duplicate paths, directory collisions and a symlink destination", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const duplicate = {
        files: { "a.ts": "x" },
        scaffold: { "a.ts": "x" },
        warnings: [],
      };
      await assertRejects(
        () => writeBindings(duplicate, { directory }),
        BindingError,
        "Duplicate",
      );
      await Deno.mkdir(`${directory}/index.ts`);
      await assertRejects(
        () =>
          writeBindings(generateBindings(bindingSpec()), {
            directory,
            force: true,
          }),
        BindingError,
        "Could not write",
      );
      await Deno.symlink(directory, `${directory}-link`);
      try {
        await assertRejects(
          () =>
            writeBindings(generateBindings(bindingSpec()), {
              directory: `${directory}-link`,
            }),
          BindingError,
          "symbolic",
        );
      } finally {
        await Deno.remove(`${directory}-link`);
      }
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
