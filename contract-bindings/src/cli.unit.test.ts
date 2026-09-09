import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  type CliIO,
  cliNetwork,
  parseCliArgs,
  resolveCliOptions,
} from "@/cli-options.ts";
import { runCli } from "@/cli.ts";
import { writeBindings } from "@/writer.ts";
import { generateBindings } from "@/generate.ts";
import { BindingError } from "@/error.ts";
import { bindingSpec } from "colibri-internal/tests/binding-fixtures.ts";

const silent: CliIO = {
  interactive: false,
  prompt: () => {
    throw new Error("Unexpected prompt");
  },
  log: () => {},
};
describe("bindings CLI", () => {
  it("parses flags strictly and resolves automation defaults", async () => {
    const flags = parseCliArgs(["--wasm=file.wasm", "--non-interactive"]);
    assertEquals((await resolveCliOptions(flags, silent)).target, "jsr");
    for (
      const args of [
        ["--typo"],
        ["--wasm"],
        ["--force=true"],
        ["--force", "--force"],
        ["x"],
        ["--wasm", "x", "--contract-id", "y"],
      ]
    ) assertThrows(() => parseCliArgs(args), BindingError);
    await assertRejects(() => resolveCliOptions({}, silent), BindingError);
    await assertRejects(
      () => resolveCliOptions({ "wasm-hash": "ab" }, silent),
      BindingError,
    );
    await assertRejects(
      () => resolveCliOptions({ wasm: "x", output: "invalid" }, silent),
      BindingError,
    );
    await assertRejects(
      () => resolveCliOptions({ wasm: "x", "package-name": "x" }, silent),
      BindingError,
    );
  });
  it("prompts for missing choices while preserving supplied flags", async () => {
    const answers = [
      "wasm",
      "file.wasm",
      "package",
      "npm",
      "@example/token",
      "Token",
      "./out",
    ];
    const io: CliIO = {
      interactive: true,
      prompt: () => answers.shift()!,
      log: () => {},
    };
    const flags = await resolveCliOptions({}, io);
    assertEquals(flags.wasm, "file.wasm");
    assertEquals(flags.target, "npm");
    assertEquals(flags["class-name"], "Token");
    assertEquals(answers.length, 0);
    await assertRejects(
      () => resolveCliOptions({}, { ...io, prompt: () => null }),
      BindingError,
      "cancelled",
    );
    await assertRejects(
      () => resolveCliOptions({}, { ...io, prompt: () => "" }),
      BindingError,
    );
    await assertRejects(
      () => resolveCliOptions({}, { ...io, prompt: () => "typo" }),
      BindingError,
    );
    const custom = await resolveCliOptions({
      "contract-id": "x",
      network: "custom",
      output: "files",
      target: "jsr",
      out: "x",
      "class-name": "Token",
    }, {
      ...io,
      prompt: (message) =>
        message.startsWith("RPC") ? "http://localhost:8000" : "local",
    });
    assertEquals(
      cliNetwork({ ...custom, "allow-http": true }).networkPassphrase,
      "local",
    );
    for (const network of ["testnet", "futurenet", "mainnet"]) {
      assert(cliNetwork({ network }).networkPassphrase);
    }
    assertThrows(() => cliNetwork({ network: "unknown" }), BindingError);
    assertThrows(
      () => cliNetwork({ network: "testnet", "network-passphrase": "custom" }),
      BindingError,
    );
  });
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
      assertEquals(result.written, ["generated/bindings.ts"]);
      assertEquals(
        await Deno.readTextFile(`${directory}/mod.ts`),
        "// my setup\n",
      );
      await Deno.writeTextFile(
        `${directory}/generated/bindings.ts`,
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
  it("runs offline end to end and reports help and missing files", async () => {
    const directory = await Deno.makeTempDir();
    try {
      assertEquals(await runCli(["--help"], silent), undefined);
      const result = await runCli([
        "--wasm",
        "_internal/tests/compiled-contracts/types_harness.wasm",
        "--out",
        directory,
        "--non-interactive",
      ], silent);
      assert(result?.written.includes("bindings.ts"));
      await assertRejects(
        () => runCli(["--wasm", `${directory}/absent.wasm`], silent),
        BindingError,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});

describe("output failure boundaries", () => {
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
      await Deno.mkdir(`${directory}/bindings.ts`);
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
