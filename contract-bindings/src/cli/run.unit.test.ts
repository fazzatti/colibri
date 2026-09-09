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
      await assertRejects(
        () => runCli(["--wasm", `${directory}/absent.wasm`], silent),
        BindingError,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
