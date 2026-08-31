import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type {
  ContractBuildVerificationInput,
  ContractBuildVerificationResult,
} from "@/core/index.ts";
import { testEvidence, testWasm } from "@/testing.test.ts";
import { InvalidCliArgumentsError } from "@/cli/error.ts";
import {
  formatBuildVerificationErrorSummary,
  formatBuildVerificationResultSummary,
} from "@/cli/format.ts";
import {
  BUILD_VERIFICATION_CLI_HELP,
  getBuildVerificationStringFlag,
  parseBuildVerificationFlags,
  verificationInputFromFlags,
  verificationNetworkFromFlags,
  verificationSourceFromFlags,
  verificationTargetFromFlags,
} from "@/cli/flags.ts";
import type { BuildVerificationCliIo } from "@/cli/io.ts";
import { runBuildVerificationCli } from "@/cli/run.ts";

const harness = (overrides: Partial<BuildVerificationCliIo> = {}) => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: BuildVerificationCliIo = {
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
    readFile: () => Promise.resolve(testWasm()),
    readTextFile: () =>
      Promise.resolve(JSON.stringify({
        image: `docker.io/stellar/stellar-cli@sha256:${"a".repeat(64)}`,
      })),
    ...overrides,
  };
  return { stdout, stderr, io };
};

const TARGET_HASH = "1".repeat(64);
const REBUILT_HASH = "2".repeat(64);
const EMPTY_WASM_HASH =
  "93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476";

const result = (
  status: "verified" | "mismatch" = "verified",
): ContractBuildVerificationResult => ({
  status,
  evidence: {
    ...testEvidence(),
    target: {
      kind: "wasm",
      wasmHash: TARGET_HASH,
      observedAt: "2026-08-28T12:00:00.000Z",
    },
    artifact: {
      path: "target/release/contract.wasm",
      size: 8,
      sha256: status === "verified" ? TARGET_HASH : REBUILT_HASH,
    },
  },
});

describe("build-verification CLI flags", () => {
  it("parses value and boolean flags and returns only string values", () => {
    const flags = parseBuildVerificationFlags([
      "--wasm",
      "target.wasm",
      "--allow-http",
      "--json",
    ]);
    assertEquals(
      flags,
      new Map<string, string | true>([
        ["wasm", "target.wasm"],
        ["allow-http", true],
        ["json", true],
      ]),
    );
    assertEquals(getBuildVerificationStringFlag(flags, "wasm"), "target.wasm");
    assertEquals(
      getBuildVerificationStringFlag(flags, "allow-http"),
      undefined,
    );
  });

  it("rejects positional, unknown, repeated, and valueless flags", () => {
    for (
      const args of [
        ["positional"],
        ["--unknown"],
        ["--wasm", "a", "--wasm", "b"],
        ["--wasm"],
        ["--wasm", "--help"],
      ]
    ) {
      assertThrows(
        () => parseBuildVerificationFlags(args),
        InvalidCliArgumentsError,
      );
    }
  });

  it("creates each exclusive target and maps target file failures", async () => {
    const io = harness().io;
    assertEquals(
      await verificationTargetFromFlags(
        parseBuildVerificationFlags(["--contract-id", "C123"]),
        io,
      ),
      { contractId: "C123" },
    );
    assertEquals(
      await verificationTargetFromFlags(
        parseBuildVerificationFlags(["--wasm-hash", "abc"]),
        io,
      ),
      { wasmHash: "abc" },
    );
    assertEquals(
      await verificationTargetFromFlags(
        parseBuildVerificationFlags(["--wasm", "target.wasm"]),
        io,
      ),
      { wasm: testWasm(), label: "target.wasm" },
    );
    await assertRejects(
      () => verificationTargetFromFlags(new Map(), io),
      InvalidCliArgumentsError,
    );
    await assertRejects(
      () =>
        verificationTargetFromFlags(
          parseBuildVerificationFlags(["--wasm", "a", "--wasm-hash", "b"]),
          io,
        ),
      InvalidCliArgumentsError,
    );
    await assertRejects(
      () =>
        verificationTargetFromFlags(
          parseBuildVerificationFlags(["--wasm", "missing"]),
          harness({ readFile: () => Promise.reject(new Error("missing")) }).io,
        ),
      InvalidCliArgumentsError,
    );
  });

  it("creates preset and granular network configuration exclusively", () => {
    for (const preset of ["mainnet", "testnet", "futurenet"] as const) {
      const network = verificationNetworkFromFlags(
        parseBuildVerificationFlags(["--network", preset]),
      );
      assertEquals(network && "networkConfig" in network, true);
    }
    assertEquals(
      verificationNetworkFromFlags(parseBuildVerificationFlags([
        "--rpc-url",
        "http://localhost:8000",
        "--network-passphrase",
        "passphrase",
        "--allow-http",
      ])),
      {
        rpcUrl: "http://localhost:8000",
        networkPassphrase: "passphrase",
        allowHttp: true,
      },
    );
    assertEquals(verificationNetworkFromFlags(new Map()), undefined);
    for (
      const args of [
        ["--network", "testnet", "--rpc-url", "https://rpc"],
        ["--network", "unknown"],
        ["--rpc-url", "https://rpc"],
        ["--network-passphrase", "passphrase"],
        ["--allow-http"],
      ]
    ) {
      assertThrows(
        () => verificationNetworkFromFlags(parseBuildVerificationFlags(args)),
        InvalidCliArgumentsError,
      );
    }
  });

  it("creates every local, URL, GitHub archive, and release source", () => {
    const source = (args: string[]) =>
      verificationSourceFromFlags(parseBuildVerificationFlags(args));
    assertEquals(source(["--source", "source.tar"]), {
      type: "path",
      path: "source.tar",
    });
    assertEquals(source(["--source-url", "https://example.com/source.tar"]), {
      type: "url",
      url: "https://example.com/source.tar",
    });
    assertEquals(
      source([
        "--github-owner",
        "stellar",
        "--github-repository",
        "example",
        "--github-revision",
        "abc",
      ]),
      {
        type: "githubArchive",
        owner: "stellar",
        repository: "example",
        revision: "abc",
        format: "tarGzip",
      },
    );
    assertEquals(
      source([
        "--github-owner",
        "stellar",
        "--github-repository",
        "example",
        "--github-revision",
        "abc",
        "--github-format",
        "zip",
      ]),
      {
        type: "githubArchive",
        owner: "stellar",
        repository: "example",
        revision: "abc",
        format: "zip",
      },
    );
    assertEquals(
      source([
        "--github-owner",
        "stellar",
        "--github-repository",
        "example",
        "--github-release-tag",
        "v1",
        "--github-release-asset",
        "source.tar.gz",
      ]),
      {
        type: "githubReleaseAsset",
        owner: "stellar",
        repository: "example",
        tag: "v1",
        asset: "source.tar.gz",
      },
    );
    assertEquals(source([]), undefined);
  });

  it("rejects every ambiguous or incomplete source group", () => {
    for (
      const args of [
        ["--source", "a", "--source-url", "b"],
        ["--github-revision", "abc"],
        [
          "--github-owner",
          "o",
          "--github-repository",
          "r",
          "--github-revision",
          "abc",
          "--github-release-tag",
          "v1",
          "--github-release-asset",
          "a",
        ],
        [
          "--github-owner",
          "o",
          "--github-repository",
          "r",
          "--github-revision",
          "abc",
          "--github-format",
          "tar",
        ],
        [
          "--github-owner",
          "o",
          "--github-repository",
          "r",
          "--github-release-tag",
          "v1",
        ],
        [
          "--github-owner",
          "o",
          "--github-repository",
          "r",
          "--github-release-tag",
          "v1",
          "--github-release-asset",
          "a",
          "--github-format",
          "zip",
        ],
      ]
    ) {
      assertThrows(
        () => verificationSourceFromFlags(parseBuildVerificationFlags(args)),
        InvalidCliArgumentsError,
      );
    }
  });

  it("builds strict and out-of-band inputs and maps recipe read failures", async () => {
    const io = harness().io;
    const strict = await verificationInputFromFlags(
      parseBuildVerificationFlags(["--wasm", "target.wasm"]),
      io,
    );
    assertEquals(strict.mode, "strictSep58");
    const outOfBand = await verificationInputFromFlags(
      parseBuildVerificationFlags([
        "--wasm",
        "target.wasm",
        "--source",
        "source.tar",
        "--recipe",
        "recipe.json",
      ]),
      io,
    );
    assertEquals(outOfBand.mode, "outOfBand");
    await assertRejects(
      () =>
        verificationInputFromFlags(
          parseBuildVerificationFlags([
            "--wasm",
            "target.wasm",
            "--recipe",
            "recipe.json",
          ]),
          io,
        ),
      InvalidCliArgumentsError,
    );
    for (
      const readTextFile of [
        () => Promise.reject(new Error("missing")),
        () => Promise.resolve("not-json"),
      ]
    ) {
      await assertRejects(
        () =>
          verificationInputFromFlags(
            parseBuildVerificationFlags([
              "--wasm",
              "target.wasm",
              "--source",
              "source.tar",
              "--recipe",
              "recipe.json",
            ]),
            harness({ readTextFile }).io,
          ),
        InvalidCliArgumentsError,
      );
    }
  });
});

describe("runBuildVerificationCli", () => {
  it("formats concise summaries for every completed result and typed error", () => {
    assertEquals(
      formatBuildVerificationResultSummary(result()),
      `VERIFIED ${TARGET_HASH}`,
    );
    assertEquals(
      formatBuildVerificationResultSummary(result("mismatch")),
      `MISMATCH target=${TARGET_HASH} rebuilt=${REBUILT_HASH}`,
    );
    const evidence = testEvidence();
    assertEquals(
      formatBuildVerificationResultSummary({
        status: "notApplicable",
        reason: "missingSep58Metadata",
        targetWasmHash: TARGET_HASH,
        evidence,
      }),
      `NOT_APPLICABLE SEP-58 metadata was not found target=${TARGET_HASH}`,
    );
    assertEquals(
      formatBuildVerificationResultSummary({
        status: "notApplicable",
        reason: "stellarAssetContract",
        evidence,
      }),
      "NOT_APPLICABLE target is a Stellar Asset Contract",
    );
    assertEquals(
      formatBuildVerificationResultSummary({
        status: "verified",
        evidence,
      }),
      "VERIFIED",
    );
    const targetEvidence = {
      ...evidence,
      target: {
        kind: "wasm" as const,
        wasmHash: TARGET_HASH,
        observedAt: "2026-08-28T12:00:00.000Z",
      },
    };
    assertEquals(
      formatBuildVerificationResultSummary({
        status: "verified",
        evidence: targetEvidence,
      }),
      `VERIFIED ${TARGET_HASH}`,
    );
    assertEquals(
      formatBuildVerificationResultSummary({
        status: "notApplicable",
        reason: "missingSep58Metadata",
        evidence: targetEvidence,
      }),
      `NOT_APPLICABLE SEP-58 metadata was not found target=${TARGET_HASH}`,
    );
    assertEquals(
      formatBuildVerificationResultSummary({
        status: "mismatch",
        evidence,
      }),
      "MISMATCH target=unknown rebuilt=unknown",
    );
    assertEquals(
      formatBuildVerificationErrorSummary(
        new InvalidCliArgumentsError("Line one.\nLine two."),
      ),
      "ERROR BLDV_031 Invalid command-line arguments: Line one. Line two.",
    );
    assertEquals(
      formatBuildVerificationErrorSummary({
        code: "TEST",
        message: "No details",
      }),
      "ERROR TEST No details",
    );
  });

  it("prints standalone help and rejects help combinations", async () => {
    const valid = harness();
    assertEquals(await runBuildVerificationCli(["--help"], valid.io), 0);
    assertEquals(valid.stdout, [BUILD_VERIFICATION_CLI_HELP]);
    const invalid = harness();
    assertEquals(
      await runBuildVerificationCli(["--help", "--allow-http"], invalid.io),
      1,
    );
    assertStringIncludes(invalid.stderr[0], "ERROR BLDV_031");
    const invalidJson = harness();
    assertEquals(
      await runBuildVerificationCli(["--help", "--json"], invalidJson.io),
      1,
    );
    assertEquals(JSON.parse(invalidJson.stderr[0]).code, "BLDV_031");
  });

  it("passes shared network/build options to the high-level verifier", async () => {
    const test = harness();
    let observedInput: ContractBuildVerificationInput | undefined;
    let observedOptions: unknown;
    const exit = await runBuildVerificationCli(
      [
        "--wasm",
        "target.wasm",
        "--rpc-url",
        "http://localhost:8000",
        "--network-passphrase",
        "passphrase",
        "--allow-http",
        "--allow-build-network",
      ],
      test.io,
      {
        createVerifier: (options) => {
          observedOptions = options;
          return {
            verify: (input) => {
              observedInput = input;
              return Promise.resolve(result());
            },
          };
        },
      },
    );
    assertEquals(exit, 0);
    assertEquals(observedInput?.mode, "strictSep58");
    assertEquals(observedOptions, {
      network: {
        rpcUrl: "http://localhost:8000",
        networkPassphrase: "passphrase",
        allowHttp: true,
      },
      allowBuildNetwork: true,
    });
    assertEquals(test.stdout, [`VERIFIED ${TARGET_HASH}`]);
  });

  it("writes evidence and either JSONL or text logs through injected writers", async () => {
    for (const format of ["jsonl", "text"] as const) {
      const test = harness();
      const writes: unknown[] = [];
      const exit = await runBuildVerificationCli(
        [
          "--wasm",
          "target.wasm",
          "--evidence",
          "evidence.json",
          "--logs",
          "events.log",
          "--log-format",
          format,
        ],
        test.io,
        {
          createVerifier: () => ({ verify: () => Promise.resolve(result()) }),
          writeEvidence: (path, value) => {
            writes.push(["evidence", path, value]);
            return Promise.resolve();
          },
          writeLogs: (path, events, options) => {
            writes.push(["logs", path, events, options]);
            return Promise.resolve();
          },
        },
      );
      assertEquals(exit, 0);
      assertEquals(writes[0], ["evidence", "evidence.json", result()]);
      assertEquals(writes[1], ["logs", "events.log", [], { format }]);
    }
  });

  it("uses the package evidence and log writers when output paths are provided", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const evidencePath = `${directory}/evidence.json`;
      const logsPath = `${directory}/events.jsonl`;
      const test = harness();
      assertEquals(
        await runBuildVerificationCli(
          [
            "--wasm",
            "target.wasm",
            "--evidence",
            evidencePath,
            "--logs",
            logsPath,
          ],
          test.io,
          {
            createVerifier: () => ({ verify: () => Promise.resolve(result()) }),
          },
        ),
        0,
      );
      assertEquals(
        JSON.parse(await Deno.readTextFile(evidencePath)).package.name,
        "@colibri/build-verification",
      );
      assertEquals(await Deno.readTextFile(logsPath), "");
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  it("defaults log output to JSONL and uses mismatch exit code 2", async () => {
    const test = harness();
    let format: unknown;
    const exit = await runBuildVerificationCli(
      [
        "--wasm",
        "target.wasm",
        "--logs",
        "events.log",
      ],
      test.io,
      {
        createVerifier: () => ({
          verify: () => Promise.resolve(result("mismatch")),
        }),
        writeLogs: (_path, _events, options) => {
          format = options;
          return Promise.resolve();
        },
      },
    );
    assertEquals(exit, 2);
    assertEquals(format, { format: "jsonl" });
    assertEquals(
      test.stdout,
      [`MISMATCH target=${TARGET_HASH} rebuilt=${REBUILT_HASH}`],
    );
  });

  it("validates log formatting flags before verification", async () => {
    for (
      const args of [
        ["--wasm", "target.wasm", "--log-format", "xml", "--logs", "events"],
        ["--wasm", "target.wasm", "--log-format", "text"],
      ]
    ) {
      const test = harness();
      assertEquals(await runBuildVerificationCli(args, test.io), 1);
      assertStringIncludes(test.stderr[0], "ERROR BLDV_031");
    }
  });

  it("preserves typed failures and normalizes unexpected failures for stderr", async () => {
    const typed = harness();
    assertEquals(await runBuildVerificationCli(["invalid"], typed.io), 1);
    assertStringIncludes(typed.stderr[0], "ERROR BLDV_031");
    const unexpected = harness();
    assertEquals(
      await runBuildVerificationCli(
        ["--wasm", "target.wasm", "--json"],
        unexpected.io,
        {
          createVerifier: () => ({
            verify: () => Promise.reject("unexpected"),
          }),
        },
      ),
      1,
    );
    assertEquals(JSON.parse(unexpected.stderr[0]).code, "BLDV_031");
    assertStringIncludes(
      JSON.parse(unexpected.stderr[0]).details,
      "unexpected failure",
    );
  });

  it("prints the complete successful result only when JSON is requested", async () => {
    const test = harness();
    assertEquals(
      await runBuildVerificationCli(
        ["--wasm", "target.wasm", "--json"],
        test.io,
        {
          createVerifier: () => ({ verify: () => Promise.resolve(result()) }),
        },
      ),
      0,
    );
    assertEquals(JSON.parse(test.stdout[0]), result());
  });

  it("uses the default verifier for a strict local contract without metadata", async () => {
    const test = harness();
    assertEquals(
      await runBuildVerificationCli(["--wasm", "target.wasm"], test.io),
      0,
    );
    assertEquals(
      test.stdout,
      [
        `NOT_APPLICABLE SEP-58 metadata was not found target=${EMPTY_WASM_HASH}`,
      ],
    );
  });

  it("uses default stdout and stderr terminal boundaries", async () => {
    const originalLog = console.log;
    const originalError = console.error;
    const stdout: unknown[] = [];
    const stderr: unknown[] = [];
    console.log = (...values) => stdout.push(...values);
    console.error = (...values) => stderr.push(...values);
    try {
      assertEquals(await runBuildVerificationCli(["--help"]), 0);
      assertEquals(await runBuildVerificationCli(["invalid"]), 1);
      assertStringIncludes(String(stdout[0]), "@colibri/build-verification");
      assertStringIncludes(String(stderr[0]), "ERROR BLDV_031");
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  });
});
