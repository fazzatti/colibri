import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { runBuildVerificationCli } from "@/cli.ts";
import type { BuildVerificationCliIo } from "@/cli.ts";
import type { ContractBuildVerificationEvidence } from "@/types.ts";

const validWasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);

const harness = (overrides: Partial<BuildVerificationCliIo> = {}) => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: BuildVerificationCliIo = {
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
    readFile: () => Promise.resolve(validWasm),
    readTextFile: () => Promise.resolve("{}"),
    ...overrides,
  };
  return { stdout, stderr, io };
};

describe("build-verification CLI", () => {
  it("prints standalone help", async () => {
    const test = harness();
    assertEquals(await runBuildVerificationCli(["--help"], test.io), 0);
    assertStringIncludes(test.stdout[0], "Strict SEP-58 verification");
  });

  it("prints a notApplicable strict result for local wasm without metadata", async () => {
    const test = harness();
    assertEquals(
      await runBuildVerificationCli([
        "--wasm",
        "target.wasm",
        "--evidence",
        "unused.json",
      ], test.io),
      0,
    );
    assertEquals(JSON.parse(test.stdout[0]).status, "notApplicable");
    assertEquals(test.stderr, []);
  });

  it("uses the default terminal boundary", async () => {
    const original = console.log;
    const values: unknown[] = [];
    console.log = (...args) => values.push(...args);
    try {
      assertEquals(await runBuildVerificationCli(["--help"]), 0);
      assertStringIncludes(String(values[0]), "@colibri/build-verification");
    } finally {
      console.log = original;
    }
  });

  it("writes comparison evidence and returns the mismatch exit code", async () => {
    const test = harness();
    let writtenPath = "";
    const evidence = { mode: "outOfBand" } as ContractBuildVerificationEvidence;
    const status = await runBuildVerificationCli(
      ["--wasm", "target.wasm", "--evidence", "evidence.json"],
      test.io,
      {
        createVerifier: () => ({
          verify: () => Promise.resolve({ status: "mismatch", evidence }),
        }),
        writeEvidence: (path, received) => {
          writtenPath = path;
          assertEquals(received, evidence);
          return Promise.resolve();
        },
      },
    );
    assertEquals(status, 2);
    assertEquals(writtenPath, "evidence.json");
  });

  it("uses the default evidence writer", async () => {
    const directory = await Deno.makeTempDir();
    const path = `${directory}/evidence.json`;
    const test = harness();
    const evidence = { mode: "outOfBand" } as ContractBuildVerificationEvidence;
    try {
      assertEquals(
        await runBuildVerificationCli(
          ["--wasm", "target.wasm", "--evidence", path],
          test.io,
          {
            createVerifier: () => ({
              verify: () => Promise.resolve({ status: "verified", evidence }),
            }),
          },
        ),
        0,
      );
      assertEquals(JSON.parse(await Deno.readTextFile(path)).mode, "outOfBand");
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  it("rejects malformed flag syntax", async () => {
    for (
      const args of [
        ["positional"],
        ["--unknown"],
        ["--wasm", "a", "--wasm", "b"],
        ["--wasm"],
        ["--help", "--allow-http"],
      ]
    ) {
      const test = harness();
      assertEquals(await runBuildVerificationCli(args, test.io), 1);
      assertEquals(JSON.parse(test.stderr[0]).code, "BLDV_031");
    }
  });

  it("requires exactly one readable target", async () => {
    for (
      const args of [
        [],
        ["--wasm", "a", "--wasm-hash", "b"],
      ]
    ) {
      const test = harness();
      assertEquals(await runBuildVerificationCli(args, test.io), 1);
    }
    const unreadable = harness({
      readFile: () => Promise.reject(new Error("missing")),
    });
    assertEquals(
      await runBuildVerificationCli(["--wasm", "missing.wasm"], unreadable.io),
      1,
    );
    const contract = harness();
    assertEquals(
      await runBuildVerificationCli(["--contract-id", "CINVALID"], contract.io),
      1,
    );
    const hash = harness();
    assertEquals(
      await runBuildVerificationCli(["--wasm-hash", "a".repeat(64)], hash.io),
      1,
    );
  });

  it("validates network flag combinations and presets", async () => {
    for (
      const args of [
        ["--wasm", "a", "--network", "testnet", "--rpc-url", "http://rpc"],
        ["--wasm", "a", "--network", "unknown"],
        ["--wasm", "a", "--rpc-url", "http://rpc"],
        ["--wasm", "a", "--network-passphrase", "passphrase"],
        ["--wasm", "a", "--allow-http"],
      ]
    ) {
      const test = harness();
      assertEquals(await runBuildVerificationCli(args, test.io), 1);
    }
    for (const preset of ["mainnet", "testnet", "futurenet"]) {
      const test = harness();
      assertEquals(
        await runBuildVerificationCli(
          ["--wasm", "a", "--network", preset],
          test.io,
        ),
        0,
      );
    }
    const granular = harness();
    assertEquals(
      await runBuildVerificationCli([
        "--wasm",
        "a",
        "--rpc-url",
        "http://localhost:8000",
        "--network-passphrase",
        "passphrase",
        "--allow-http",
      ], granular.io),
      0,
    );
  });

  it("validates source and out-of-band recipe inputs", async () => {
    const both = harness();
    assertEquals(
      await runBuildVerificationCli([
        "--wasm",
        "a",
        "--source",
        "a.tar",
        "--source-url",
        "https://example.com/a.tar",
      ], both.io),
      1,
    );
    const missingSource = harness();
    assertEquals(
      await runBuildVerificationCli(
        ["--wasm", "a", "--recipe", "recipe.json"],
        missingSource.io,
      ),
      1,
    );
    const unreadable = harness({
      readTextFile: () => Promise.reject(new Error("missing")),
    });
    assertEquals(
      await runBuildVerificationCli([
        "--wasm",
        "a",
        "--source",
        ".",
        "--recipe",
        "recipe.json",
      ], unreadable.io),
      1,
    );
    const malformed = harness({
      readTextFile: () => Promise.resolve("not-json"),
    });
    assertEquals(
      await runBuildVerificationCli([
        "--wasm",
        "a",
        "--source",
        ".",
        "--recipe",
        "recipe.json",
      ], malformed.io),
      1,
    );
    const invalidRecipe = harness({
      readTextFile: () => Promise.resolve(JSON.stringify({ image: "latest" })),
    });
    assertEquals(
      await runBuildVerificationCli([
        "--wasm",
        "a",
        "--source-url",
        "https://example.com/source.tar",
        "--recipe",
        "recipe.json",
        "--allow-build-network",
      ], invalidRecipe.io),
      1,
    );
  });

  it("normalizes unexpected terminal failures into a typed CLI error", async () => {
    const test = harness({
      stdout: () => {
        throw "terminal failed";
      },
    });
    assertEquals(await runBuildVerificationCli(["--help"], test.io), 1);
    assertEquals(JSON.parse(test.stderr[0]).code, "BLDV_031");
  });

  it("uses the default stderr boundary", async () => {
    const original = console.error;
    const values: unknown[] = [];
    console.error = (...args) => values.push(...args);
    try {
      assertEquals(await runBuildVerificationCli(["invalid"]), 1);
      assertEquals(JSON.parse(String(values[0])).code, "BLDV_031");
    } finally {
      console.error = original;
    }
  });
});
