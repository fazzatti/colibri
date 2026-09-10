import { stub } from "@std/testing/mock";
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
import { contractId } from "colibri-internal/tests/binding-fixtures.ts";

const wasm = "_internal/tests/compiled-contracts/types_harness.wasm";

const silent: CliIO = {
  interactive: false,
  prompt: () => {
    throw new Error("Unexpected prompt");
  },
  log: () => {},
};
describe("bindings CLI", () => {
  it("prints help through the default terminal without prompting", async () => {
    let output = "";
    using _write = stub(Deno.stdout, "writeSync", (data) => {
      output += new TextDecoder().decode(data);
      return data.length;
    });
    assertEquals(await runCli(["--help"]), undefined);
    assert(output.includes("Colibri contract bindings"));
    assert(output.includes("--wasm FILE"));
  });
  it("reports a WASM that disappears after validation without creating output", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const cause = new Deno.errors.NotFound("WASM removed after validation");
      using _read = stub(Deno, "readFile", () => Promise.reject(cause));
      const error = await assertRejects(
        () =>
          runCli([
            "--wasm",
            wasm,
            "--output",
            "files",
            "--target",
            "jsr",
            "--out",
            `${directory}/output`,
            "--non-interactive",
          ], silent),
        BindingError,
        "Could not read the Wasm file",
      );
      assertEquals(error.code, "CBG_003");
      assertEquals(error.meta?.cause, cause);
      assertEquals(Array.from(Deno.readDirSync(directory)), []);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("re-prompts a mistyped contract ID before displaying the network menu", async () => {
    const questions: string[] = [];
    const feedback: string[] = [];
    const answers = [
      "decodeInvocationResult",
      contractId.slice(0, -1) + "A",
      ` ${contractId} `,
    ];
    const flags = await resolveCliOptions({
      output: "files",
      target: "jsr",
      out: "./bindings",
    }, {
      interactive: true,
      select: (message) => {
        questions.push(message);
        if (message === "Select the contract source") return "contract-id";
        assertEquals(answers, []);
        return "testnet";
      },
      prompt: (message) => {
        questions.push(message);
        return answers.shift() ?? null;
      },
      log: (message) => feedback.push(message),
    });
    assertEquals(flags["contract-id"], contractId);
    assertEquals(questions, [
      "Select the contract source",
      "Input the contract ID",
      "Input the contract ID",
      "Input the contract ID",
      "Select the network",
    ]);
    assertEquals(feedback.length, 2);
    assert(feedback.every((message) => message.includes("checksum")));
  });

  it("rejects invalid flags before any prompts or output, even in interactive mode", async () => {
    for (
      const args of [
        ["--contract-id", "decodeInvocationResult"],
        ["--wasm-hash", "wrong"],
        ["--contract-id", contractId, "--rpc-url", "wrong"],
        ["--contract-id", contractId, "--class-name", "bad name"],
        ...["unknown", "any", "never", "Object", "Promise", "ContractId"]
          .map((name) => ["--contract-id", contractId, "--class-name", name]),
      ]
    ) {
      const error = await assertRejects(
        () => runCli(args, { ...silent, interactive: true }),
        BindingError,
      );
      assertEquals(error.code, "CBG_001");
    }
  });

  it("rejects incompatible valid flags before asking for a source", async () => {
    const cases = [
      {
        args: ["--output", "files", "--package-name", "@example/token"],
        message: "--package-name requires --output package",
      },
      ...["mainnet", "testnet", "futurenet"].map((network) => ({
        args: ["--network", network, "--network-passphrase", "Custom network"],
        message: "--network-passphrase requires --network custom",
      })),
    ];
    const io: CliIO = {
      ...silent,
      interactive: true,
      select: () => {
        throw new Error("Unexpected menu before flag validation");
      },
    };
    for (const { args, message } of cases) {
      const error = await assertRejects(
        () => runCli(args, io),
        BindingError,
        message,
      );
      assertEquals(error.code, "CBG_001");
    }
  });

  it("allows cancellation after invalid input and retries blank choices", async () => {
    for (const invalid of ["", "typo"]) {
      const answers = [invalid, null];
      const feedback: string[] = [];
      const error = await assertRejects(() =>
        resolveCliOptions({}, {
          interactive: true,
          prompt: () => answers.shift() ?? null,
          log: (message) => feedback.push(message),
        }), BindingError);
      assertEquals(error.code, "CBG_005");
      assertEquals(feedback.length, 1);
    }
  });

  it("parses flags strictly and resolves automation defaults", async () => {
    const flags = parseCliArgs([`--wasm=${wasm}`, "--non-interactive"]);
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
      () => resolveCliOptions({ wasm, output: "invalid" }, silent),
      BindingError,
    );
    await assertRejects(
      () => resolveCliOptions({ wasm, "package-name": "x" }, silent),
      BindingError,
    );
  });
  it("prompts for missing choices while preserving supplied flags", async () => {
    const answers = [
      "wasm",
      wasm,
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
    assertEquals(flags.wasm, wasm);
    assertEquals(flags.target, "npm");
    assertEquals(flags["class-name"], undefined);
    assertEquals(answers.length, 0);
    await assertRejects(
      () => resolveCliOptions({}, { ...io, prompt: () => null }),
      BindingError,
      "cancelled",
    );
    await assertRejects(
      () => resolveCliOptions({}, { ...io, prompt: () => null }),
      BindingError,
    );
    await assertRejects(
      () => resolveCliOptions({}, { ...io, prompt: () => null }),
      BindingError,
    );
    const custom = await resolveCliOptions({
      "contract-id": contractId,
      network: "custom",
      "allow-http": true,
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
          return fallback ??
            (message.includes("WASM file")
              ? wasm
              : message.includes("contract ID")
              ? contractId
              : message.includes("WASM hash")
              ? "ab".repeat(32)
              : message.includes("RPC")
              ? "https://rpc.example.com"
              : "local");
        },
        log: () => {},
      });
      assertEquals(
        resolved[source],
        source === "wasm"
          ? wasm
          : source === "contract-id"
          ? contractId
          : "ab".repeat(32),
      );
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
      wasm,
      output: "files",
      target: "npm",
      out: "out",
      "class-name": "Token",
    };
    assertEquals(await resolveCliOptions(supplied, io), supplied);
    assertEquals(
      (await resolveCliOptions(
        { wasm, "non-interactive": true },
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
        "contract-id": contractId,
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
