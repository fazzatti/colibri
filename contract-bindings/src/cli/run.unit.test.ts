import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  type CliIO,
  cliNetwork,
  parseCliArgs,
  resolveCliOptions,
} from "@/cli/options.ts";
import { runCli } from "@/cli/run.ts";
import { BindingError } from "@/error.ts";

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
    assertEquals(flags["class-name"], undefined);
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
        message.includes("RPC") ? "http://localhost:8000" : "local",
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
  it("uses menus for finite choices and explicit prompts for source values", async () => {
    for (
      const [source, prompt] of [
        ["wasm", "Input the path to the WASM file"],
        ["contract-id", "Input the contract ID"],
        ["wasm-hash", "Input the WASM hash"],
      ]
    ) {
      const menus: string[][] = [];
      const questions: string[] = [];
      const choices = source === "wasm"
        ? [source, "files", "jsr"]
        : [source, "custom", "files", "jsr"];
      const resolved = await resolveCliOptions({}, {
        interactive: true,
        select: (_message, options) => {
          menus.push(options.map((option) => option.value));
          return choices.shift()!;
        },
        prompt: (message, fallback) => {
          questions.push(message);
          return fallback ?? "pasted value";
        },
        log: () => {},
      });
      assertEquals(resolved[source], "pasted value");
      assertEquals(questions[0], prompt);
      assertEquals(menus[0], ["wasm", "contract-id", "wasm-hash"]);
      if (source !== "wasm") {
        assertEquals(menus[1], ["mainnet", "testnet", "futurenet", "custom"]);
        assertEquals(questions.slice(1, 3), [
          "Input the RPC URL",
          "Input the network passphrase",
        ]);
      }
      assertEquals(choices, []);
      assert(!questions.some((message) => message.includes("class")));
      assertEquals(resolved.out, "./bindings");
    }
  });
  it("skips supplied choices, retains explicit names and never prompts in automation", async () => {
    const io: CliIO = {
      ...silent,
      interactive: true,
      select: () => {
        throw new Error("Unexpected menu");
      },
    };
    const supplied = {
      wasm: "token.wasm",
      output: "files",
      target: "npm",
      out: "out",
      "class-name": "Token",
    };
    assertEquals(await resolveCliOptions(supplied, io), supplied);
    assertEquals(
      (await resolveCliOptions(
        { wasm: "token.wasm", "non-interactive": true },
        io,
      )).output,
      "files",
    );
    await assertRejects(
      () => resolveCliOptions({}, { ...io, select: () => null }),
      BindingError,
      "cancelled",
    );
    for (const network of ["mainnet", "testnet", "futurenet"]) {
      const resolved = await resolveCliOptions({
        ...supplied,
        wasm: false,
        "contract-id": "C...",
        network,
      }, io);
      assertEquals(resolved.network, network);
    }
    assertEquals(
      parseCliArgs(["--include-provenance"])["include-provenance"],
      true,
    );
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
      assert(result?.written.includes("index.ts"));
      assert(
        (await Deno.readTextFile(`${directory}/index.ts`)).includes(
          "class TypesHarness",
        ),
      );
      assert(
        !(await Deno.readTextFile(`${directory}/constants.ts`)).includes(
          "Provenance",
        ),
      );
      await runCli([
        "--wasm",
        "_internal/tests/compiled-contracts/types_harness.wasm",
        "--out",
        directory,
        "--class-name",
        "Token",
        "--include-provenance",
        "--force",
        "--non-interactive",
      ], silent);
      assert(
        (await Deno.readTextFile(`${directory}/constants.ts`)).includes(
          "TokenProvenance",
        ),
      );
      await assertRejects(
        () => runCli(["--wasm", `${directory}/absent.wasm`], silent),
        BindingError,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
