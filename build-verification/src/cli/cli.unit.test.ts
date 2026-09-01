import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriError } from "@colibri/core";
import type {
  ContractBuildVerificationInput,
  ContractBuildVerificationResult,
  VerificationLogEvent,
} from "@/core/index.ts";
import { testEvidence, testWasm } from "@/testing.test.ts";
import { CliUnexpectedFailureError } from "@/cli/error.ts";
import {
  formatBuildVerificationErrorSummary,
  formatBuildVerificationProgress,
  formatBuildVerificationResultSummary,
} from "@/cli/format.ts";
import {
  BUILD_VERIFICATION_CLI_HELP,
  getBuildVerificationStringFlag,
  parseBuildVerificationFlags,
  verificationGitHubTokenFromFlags,
  verificationInputFromFlags,
  verificationNetworkFromFlags,
  verificationSourceFromFlags,
  verificationTargetFromFlags,
} from "@/cli/flags.ts";
import {
  type BuildVerificationCliIo,
  DEFAULT_BUILD_VERIFICATION_CLI_IO,
} from "@/cli/io.ts";
import { buildVerificationFailureReport } from "@/cli/report.ts";
import { runBuildVerificationCli } from "@/cli/run.ts";
import { BuildVerificationCliExitCode } from "@/cli/types.ts";
import {
  attachBuildVerificationErrorContext,
  BuildVerificationError,
  Code,
} from "@/error/base.ts";
import { DockerUnavailableError } from "@/runners/docker/error.ts";
import {
  EvidenceWriteFailedError,
  LogWriteFailedError,
} from "@/reporting/error.ts";

const harness = (overrides: Partial<BuildVerificationCliIo> = {}) => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const stderrWrites: string[] = [];
  const io: BuildVerificationCliIo = {
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
    stderrWrite: (value) => stderrWrites.push(value),
    readFile: () => Promise.resolve(testWasm()),
    readTextFile: () =>
      Promise.resolve(JSON.stringify({
        image: `docker.io/stellar/stellar-cli@sha256:${"a".repeat(64)}`,
      })),
    getEnv: () => undefined,
    stderrIsTerminal: () => false,
    ...overrides,
  };
  return { stdout, stderr, stderrWrites, io };
};

const assertThrowsCode = (callback: () => unknown, code: Code): void => {
  const error = assertThrows(callback, BuildVerificationError);
  assertEquals(error.code, code);
};

const assertRejectsCode = async (
  callback: () => Promise<unknown>,
  code: Code,
): Promise<void> => {
  const error = await assertRejects(callback, BuildVerificationError);
  assertEquals(error.code, code);
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

  it("accepts value tokens that begin with a single hyphen", () => {
    assertEquals(
      parseBuildVerificationFlags([
        "--wasm",
        "-contract.wasm",
        "--network-passphrase",
        "-passphrase",
        "--source",
        "-",
      ]),
      new Map<string, string | true>([
        ["wasm", "-contract.wasm"],
        ["network-passphrase", "-passphrase"],
        ["source", "-"],
      ]),
    );
  });

  it("parses short help and gives every malformed flag shape a unique code", () => {
    assertEquals(
      parseBuildVerificationFlags(["-h"]),
      new Map<string, string | true>([["help", true]]),
    );
    for (
      const [args, code] of [
        [["positional"], Code.CLI_POSITIONAL_ARGUMENT_UNSUPPORTED],
        [["-x"], Code.CLI_UNKNOWN_FLAG],
        [["--unknown"], Code.CLI_UNKNOWN_FLAG],
        [["--wasm", "a", "--wasm", "b"], Code.CLI_DUPLICATE_FLAG],
        [["-h", "--help"], Code.CLI_DUPLICATE_FLAG],
        [["--help", "-h"], Code.CLI_DUPLICATE_FLAG],
        [["--wasm"], Code.CLI_FLAG_VALUE_MISSING],
        [["--wasm", "--help"], Code.CLI_FLAG_VALUE_MISSING],
        [["--wasm", "-h"], Code.CLI_FLAG_VALUE_MISSING],
      ] as const
    ) {
      assertThrowsCode(
        () => parseBuildVerificationFlags(args),
        code,
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
    await assertRejectsCode(
      () => verificationTargetFromFlags(new Map(), io),
      Code.CLI_TARGET_SELECTION_INVALID,
    );
    await assertRejectsCode(
      () =>
        verificationTargetFromFlags(
          parseBuildVerificationFlags(["--wasm", "a", "--wasm-hash", "b"]),
          io,
        ),
      Code.CLI_TARGET_SELECTION_INVALID,
    );
    await assertRejectsCode(
      () =>
        verificationTargetFromFlags(
          parseBuildVerificationFlags(["--wasm", "missing"]),
          harness({ readFile: () => Promise.reject(new Error("missing")) }).io,
        ),
      Code.CLI_TARGET_FILE_READ_FAILED,
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
      const [args, code] of [
        [
          ["--network", "testnet", "--rpc-url", "https://rpc"],
          Code.CLI_NETWORK_CONFIGURATION_CONFLICT,
        ],
        [["--network", "unknown"], Code.CLI_NETWORK_PRESET_INVALID],
        [
          ["--rpc-url", "https://rpc"],
          Code.CLI_NETWORK_CONFIGURATION_INCOMPLETE,
        ],
        [
          ["--network-passphrase", "passphrase"],
          Code.CLI_NETWORK_CONFIGURATION_INCOMPLETE,
        ],
        [["--allow-http"], Code.CLI_ALLOW_HTTP_REQUIRES_NETWORK],
      ] as const
    ) {
      assertThrowsCode(
        () => verificationNetworkFromFlags(parseBuildVerificationFlags(args)),
        code,
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
      const [args, code] of [
        [
          ["--source", "a", "--source-url", "b"],
          Code.CLI_SOURCE_SELECTION_INVALID,
        ],
        [
          ["--source", "a", "--github-owner", "o"],
          Code.CLI_SOURCE_SELECTION_INVALID,
        ],
        [["--github-revision", "abc"], Code.CLI_GITHUB_SOURCE_INCOMPLETE],
        [
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
          Code.CLI_GITHUB_REVISION_CONFLICT,
        ],
        [
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
          Code.CLI_GITHUB_FORMAT_INVALID,
        ],
        [
          [
            "--github-owner",
            "o",
            "--github-repository",
            "r",
            "--github-release-tag",
            "v1",
          ],
          Code.CLI_GITHUB_RELEASE_INVALID,
        ],
        [
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
          Code.CLI_GITHUB_RELEASE_INVALID,
        ],
      ] as const
    ) {
      assertThrowsCode(
        () => verificationSourceFromFlags(parseBuildVerificationFlags(args)),
        code,
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
    await assertRejectsCode(
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
      Code.CLI_OUT_OF_BAND_SOURCE_REQUIRED,
    );
    for (
      const [readTextFile, code] of [
        [
          () => Promise.reject(new Error("missing")),
          Code.CLI_RECIPE_FILE_READ_FAILED,
        ],
        [() => Promise.resolve("not-json"), Code.CLI_RECIPE_JSON_INVALID],
      ] as const
    ) {
      await assertRejectsCode(
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
        code,
      );
    }
  });

  it("reads GitHub tokens only from an explicit environment source", () => {
    assertEquals(
      verificationGitHubTokenFromFlags(new Map(), harness().io),
      undefined,
    );
    const flags = parseBuildVerificationFlags([
      "--github-owner",
      "stellar",
      "--github-repository",
      "example",
      "--github-revision",
      "abc",
      "--github-token-env",
      "GITHUB_TOKEN",
    ]);
    assertEquals(
      verificationGitHubTokenFromFlags(
        flags,
        harness({
          getEnv: (name) => name === "GITHUB_TOKEN" ? "secret" : undefined,
        }).io,
      ),
      "secret",
    );
    assertThrowsCode(
      () =>
        verificationGitHubTokenFromFlags(
          parseBuildVerificationFlags([
            "--wasm",
            "target.wasm",
            "--github-token-env",
            "GITHUB_TOKEN",
          ]),
          harness().io,
        ),
      Code.CLI_GITHUB_TOKEN_SOURCE_REQUIRED,
    );
    assertThrowsCode(
      () => verificationGitHubTokenFromFlags(flags, harness().io),
      Code.CLI_ENVIRONMENT_VALUE_MISSING,
    );
    assertThrowsCode(
      () =>
        verificationGitHubTokenFromFlags(
          flags,
          harness({
            getEnv: () => {
              throw new Error("denied");
            },
          }).io,
        ),
      Code.CLI_ENVIRONMENT_READ_FAILED,
    );
    const fallbackFlags = new Map(flags);
    fallbackFlags.set("github-token-env", "PATH");
    assertEquals(
      verificationGitHubTokenFromFlags(fallbackFlags, {
        ...harness().io,
        getEnv: undefined,
      }),
      Deno.env.get("PATH"),
    );
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
        new CliUnexpectedFailureError("Line one.\nLine two."),
      ),
      "ERROR BLDV_130 Unexpected command-line failure: The CLI failed outside a recognized verification or reporting path.",
    );
    assertEquals(
      formatBuildVerificationErrorSummary({
        code: "TEST",
        message: "No details",
      }),
      "ERROR TEST No details",
    );
    const progress: VerificationLogEvent = {
      timestamp: "2026-09-01T12:00:00.000Z",
      stage: "resolve-verification-target",
      level: "info",
      code: "BLDV_TARGET_RESOLVED",
      message: "Target\nresolved.",
    };
    assertEquals(
      formatBuildVerificationProgress(progress),
      "INFO resolve-verification-target BLDV_TARGET_RESOLVED Target resolved.",
    );
  });

  it("prints help for empty, short, or long invocations and rejects combinations", async () => {
    for (const args of [[], ["-h"], ["--help"]]) {
      const valid = harness();
      assertEquals(
        await runBuildVerificationCli(args, valid.io),
        BuildVerificationCliExitCode.Verified,
      );
      assertEquals(valid.stdout, [BUILD_VERIFICATION_CLI_HELP]);
    }
    assertStringIncludes(BUILD_VERIFICATION_CLI_HELP, "-h, --help");
    assertStringIncludes(BUILD_VERIFICATION_CLI_HELP, "--github-format");
    assertStringIncludes(BUILD_VERIFICATION_CLI_HELP, "@0.3.0/cli");
    const invalid = harness();
    assertEquals(
      await runBuildVerificationCli(["--help", "--allow-http"], invalid.io),
      BuildVerificationCliExitCode.Failed,
    );
    assertStringIncludes(invalid.stderr[0], "ERROR BLDV_110");
    const invalidJson = harness();
    assertEquals(
      await runBuildVerificationCli(["--help", "--json"], invalidJson.io),
      BuildVerificationCliExitCode.Failed,
    );
    assertEquals(JSON.parse(invalidJson.stderr[0]).code, "BLDV_110");
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
        "--container-name-prefix",
        "contract-verifier",
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
    assertEquals(exit, BuildVerificationCliExitCode.Verified);
    assertEquals(observedInput?.mode, "strictSep58");
    assertEquals(observedOptions, {
      network: {
        rpcUrl: "http://localhost:8000",
        networkPassphrase: "passphrase",
        allowHttp: true,
      },
      allowBuildNetwork: true,
      githubToken: undefined,
      docker: { containerNamePrefix: "contract-verifier" },
      logger: undefined,
    });
    assertEquals(test.stdout, [`VERIFIED ${TARGET_HASH}`]);
  });

  it("passes an environment-backed GitHub token without exposing it in arguments", async () => {
    const test = harness({
      getEnv: (name) => name === "PRIVATE_GITHUB_TOKEN" ? "secret" : undefined,
    });
    let observedOptions: unknown;
    assertEquals(
      await runBuildVerificationCli(
        [
          "--wasm",
          "target.wasm",
          "--github-owner",
          "stellar",
          "--github-repository",
          "example",
          "--github-revision",
          "abc",
          "--github-token-env",
          "PRIVATE_GITHUB_TOKEN",
          "--recipe",
          "recipe.json",
        ],
        test.io,
        {
          createVerifier: (options) => {
            observedOptions = options;
            return { verify: () => Promise.resolve(result()) };
          },
        },
      ),
      BuildVerificationCliExitCode.Verified,
    );
    assertEquals(
      (observedOptions as { githubToken?: string }).githubToken,
      "secret",
    );
    assertEquals(test.stdout.some((value) => value.includes("secret")), false);
    assertEquals(test.stderr.some((value) => value.includes("secret")), false);
  });

  it("animates progress only for interactive non-JSON runs", async () => {
    const event: VerificationLogEvent = {
      timestamp: "2026-09-01T12:00:00.000Z",
      stage: "resolve-verification-target",
      level: "info",
      code: "BLDV_TARGET_RESOLVED",
      message: "Target resolved.",
    };
    for (
      const [extraArgs, terminal, expectedSpinner] of [
        [[], true, true],
        [["--quiet"], true, false],
        [["--json"], true, false],
        [[], false, false],
      ] as const
    ) {
      const test = harness({ stderrIsTerminal: () => terminal });
      await runBuildVerificationCli(
        ["--wasm", "target.wasm", ...extraArgs],
        test.io,
        {
          createVerifier: (options) => ({
            verify: async () => {
              await options.logger?.log(event);
              return result();
            },
          }),
        },
      );
      assertEquals(
        test.stderrWrites.some((value) =>
          value.includes("Verifying contract build")
        ),
        expectedSpinner,
      );
      assertEquals(test.stderr.length, 0);
      if (expectedSpinner) {
        assertStringIncludes(
          test.stderrWrites.join(""),
          "Resolving verification target…",
        );
        assertEquals(test.stderrWrites.at(-1), "\r\x1b[2K");
      }
    }
  });

  it("retains line progress when an interactive custom IO has no raw writer", async () => {
    const event: VerificationLogEvent = {
      timestamp: "2026-09-01T12:00:00.000Z",
      stage: "resolve-verification-target",
      level: "info",
      code: "BLDV_TARGET_RESOLVED",
      message: "Target resolved.",
    };
    const test = harness({
      stderrIsTerminal: () => true,
      stderrWrite: undefined,
    });
    await runBuildVerificationCli(
      ["--wasm", "target.wasm"],
      test.io,
      {
        createVerifier: (options) => ({
          verify: async () => {
            await options.logger?.log(event);
            return result();
          },
        }),
      },
    );
    assertEquals(test.stderr, [formatBuildVerificationProgress(event)]);
    assertEquals(test.stderrWrites, []);
  });

  it("clears the interactive spinner before printing a failure", async () => {
    const test = harness({ stderrIsTerminal: () => true });
    assertEquals(
      await runBuildVerificationCli(
        ["--wasm", "target.wasm"],
        test.io,
        {
          createVerifier: () => ({
            verify: () =>
              Promise.reject(new DockerUnavailableError(new Error("offline"))),
          }),
        },
      ),
      BuildVerificationCliExitCode.Failed,
    );
    assertEquals(test.stderrWrites.at(-1), "\r\x1b[2K");
    assertStringIncludes(test.stderr[0], `ERROR ${Code.DOCKER_UNAVAILABLE}`);
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
      assertEquals(exit, BuildVerificationCliExitCode.Verified);
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
        BuildVerificationCliExitCode.Verified,
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
    assertEquals(exit, BuildVerificationCliExitCode.Mismatch);
    assertEquals(format, { format: "jsonl" });
    assertEquals(
      test.stdout,
      [`MISMATCH target=${TARGET_HASH} rebuilt=${REBUILT_HASH}`],
    );
  });

  it("validates log formatting flags before verification", async () => {
    for (
      const [args, code] of [
        [
          ["--wasm", "target.wasm", "--log-format", "xml", "--logs", "events"],
          Code.CLI_LOG_FORMAT_INVALID,
        ],
        [
          ["--wasm", "target.wasm", "--log-format", "text"],
          Code.CLI_LOG_FORMAT_REQUIRES_LOGS,
        ],
      ] as const
    ) {
      const test = harness();
      assertEquals(
        await runBuildVerificationCli(args, test.io, {
          writeLogs: () => Promise.resolve(),
        }),
        BuildVerificationCliExitCode.Failed,
      );
      assertStringIncludes(test.stderr[0], `ERROR ${code}`);
    }
  });

  it("preserves typed failures and normalizes unexpected failures for stderr", async () => {
    const typed = harness();
    assertEquals(
      await runBuildVerificationCli(["invalid"], typed.io),
      BuildVerificationCliExitCode.Failed,
    );
    assertStringIncludes(typed.stderr[0], "ERROR BLDV_106");
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
      BuildVerificationCliExitCode.Failed,
    );
    assertEquals(JSON.parse(unexpected.stderr[0]).code, "BLDV_130");
    assertStringIncludes(
      JSON.parse(unexpected.stderr[0]).details,
      "outside a recognized",
    );

    const runtime = harness();
    await runBuildVerificationCli(
      ["--wasm", "target.wasm"],
      runtime.io,
      {
        createVerifier: () => {
          throw new Error("runtime");
        },
      },
    );
    assertStringIncludes(
      runtime.stderr[0],
      `ERROR ${Code.CLI_RUNTIME_INITIALIZATION_FAILED}`,
    );

    const typedRuntime = harness();
    await runBuildVerificationCli(
      ["--wasm", "target.wasm"],
      typedRuntime.io,
      {
        createVerifier: () => {
          throw new DockerUnavailableError(new Error("offline"));
        },
      },
    );
    assertStringIncludes(
      typedRuntime.stderr[0],
      `ERROR ${Code.DOCKER_UNAVAILABLE}`,
    );
  });

  it("returns typed JSON for cyclic, bigint, and reporting failure causes", async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (
      const [cause, expectedCause] of [
        [cyclic, { type: "Object" }],
        [7n, { type: "bigint", value: "7" }],
      ] as const
    ) {
      const test = harness();
      assertEquals(
        await runBuildVerificationCli(
          ["--wasm", "target.wasm", "--json"],
          test.io,
          {
            createVerifier: () => ({
              verify: () => Promise.reject(cause),
            }),
          },
        ),
        BuildVerificationCliExitCode.Failed,
      );
      const output = JSON.parse(test.stderr[0]);
      assertEquals(output.code, Code.CLI_UNEXPECTED_FAILURE);
      assertEquals(output.meta.cause, expectedCause);
    }

    const typedError = new DockerUnavailableError(cyclic);
    const typed = harness();
    assertEquals(
      await runBuildVerificationCli(
        ["--wasm", "target.wasm", "--json"],
        typed.io,
        {
          createVerifier: () => ({ verify: () => Promise.reject(typedError) }),
        },
      ),
      BuildVerificationCliExitCode.Failed,
    );
    assertStrictEquals(typedError.meta?.cause, cyclic);
    assertEquals(JSON.parse(typed.stderr[0]).meta.cause, { type: "Object" });

    const reporting = harness();
    assertEquals(
      await runBuildVerificationCli(
        [
          "--wasm",
          "target.wasm",
          "--json",
          "--evidence",
          "failure.json",
          "--logs",
          "failure.jsonl",
        ],
        reporting.io,
        {
          createVerifier: () => ({ verify: () => Promise.reject(typedError) }),
          writeEvidence: () => Promise.reject(cyclic),
          writeLogs: () => Promise.reject(11n),
        },
      ),
      BuildVerificationCliExitCode.Failed,
    );
    const reportingOutput = JSON.parse(reporting.stderr[0]);
    assertEquals(
      reportingOutput.reportingErrors.map(
        (error: { meta: { cause: unknown } }) => error.meta.cause,
      ),
      [{ type: "Object" }, { type: "bigint", value: "11" }],
    );
  });

  it("writes partial evidence and logs when verification fails", async () => {
    const event: VerificationLogEvent = {
      timestamp: "2026-09-01T12:00:00.000Z",
      stage: "execute-contract-build",
      level: "error",
      code: "BLDV_BUILD_FAILED",
      message: "Build failed.",
    };
    const evidence = { ...testEvidence(), logs: [event] };
    const failure = attachBuildVerificationErrorContext(
      new DockerUnavailableError(new Error("offline")),
      { evidence, logs: [event] },
    );
    const writes: unknown[] = [];
    const test = harness();
    assertEquals(
      await runBuildVerificationCli(
        [
          "--wasm",
          "target.wasm",
          "--evidence",
          "failure.json",
          "--logs",
          "failure.jsonl",
        ],
        test.io,
        {
          createVerifier: () => ({ verify: () => Promise.reject(failure) }),
          writeEvidence: (path, value) => {
            writes.push(["evidence", path, value]);
            return Promise.resolve();
          },
          writeLogs: (path, logs, options) => {
            writes.push(["logs", path, logs, options]);
            return Promise.resolve();
          },
        },
      ),
      BuildVerificationCliExitCode.Failed,
    );
    const report = (writes[0] as [
      string,
      string,
      { status: string; error: { code: string } },
    ])[2];
    assertEquals(report.status, "failed");
    assertEquals(report.error.code, Code.DOCKER_UNAVAILABLE);
    assertEquals(writes[1], ["logs", "failure.jsonl", [event], {
      format: "jsonl",
    }]);
    assertStringIncludes(test.stderr[0], `ERROR ${Code.DOCKER_UNAVAILABLE}`);
  });

  it("uses package writers for failure evidence and logs", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const evidencePath = `${directory}/failure.json`;
      const logsPath = `${directory}/failure.jsonl`;
      const evidence = testEvidence();
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      const failure = attachBuildVerificationErrorContext(
        new DockerUnavailableError(cyclic),
        { evidence, logs: [] },
      );
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
          harness().io,
          {
            createVerifier: () => ({ verify: () => Promise.reject(failure) }),
          },
        ),
        BuildVerificationCliExitCode.Failed,
      );
      const report = JSON.parse(await Deno.readTextFile(evidencePath));
      assertEquals(report.status, "failed");
      assertEquals(report.error.code, Code.DOCKER_UNAVAILABLE);
      assertEquals(report.error.meta.cause, { type: "Object" });
      assertEquals(report.evidence, evidence);
      assertEquals(await Deno.readTextFile(logsPath), "");
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  it("reports secondary failure-artifact errors without hiding the primary error", async () => {
    const failure = new DockerUnavailableError(new Error("offline"));
    const test = harness();
    assertEquals(
      await runBuildVerificationCli(
        [
          "--wasm",
          "target.wasm",
          "--json",
          "--evidence",
          "failure.json",
          "--logs",
          "failure.jsonl",
        ],
        test.io,
        {
          createVerifier: () => ({ verify: () => Promise.reject(failure) }),
          writeEvidence: () =>
            Promise.reject(
              new EvidenceWriteFailedError("failure.json", failure),
            ),
          writeLogs: () =>
            Promise.reject(new LogWriteFailedError("failure.jsonl", failure)),
        },
      ),
      BuildVerificationCliExitCode.Failed,
    );
    const output = JSON.parse(test.stderr[0]);
    assertEquals(output.code, Code.DOCKER_UNAVAILABLE);
    assertEquals(
      output.reportingErrors.map(({ code }: { code: string }) => code),
      [Code.EVIDENCE_WRITE_FAILED, Code.LOG_WRITE_FAILED],
    );

    const unexpectedReporting = harness();
    await runBuildVerificationCli(
      [
        "--wasm",
        "target.wasm",
        "--json",
        "--evidence",
        "failure.json",
        "--logs",
        "failure.jsonl",
      ],
      unexpectedReporting.io,
      {
        createVerifier: () => ({ verify: () => Promise.reject(failure) }),
        writeEvidence: () => Promise.reject("unexpected writer failure"),
        writeLogs: () => Promise.reject("unexpected log writer failure"),
      },
    );
    assertEquals(
      JSON.parse(unexpectedReporting.stderr[0]).reportingErrors.map(
        ({ code }: { code: string }) => code,
      ),
      [Code.EVIDENCE_WRITE_FAILED, Code.LOG_WRITE_FAILED],
    );

    const summary = harness();
    await runBuildVerificationCli(
      ["--wasm", "target.wasm", "--evidence", "failure.json"],
      summary.io,
      {
        createVerifier: () => ({ verify: () => Promise.reject(failure) }),
        writeEvidence: () =>
          Promise.reject(new EvidenceWriteFailedError("failure.json", failure)),
      },
    );
    assertStringIncludes(summary.stderr[0], `ERROR ${Code.DOCKER_UNAVAILABLE}`);
    assertStringIncludes(
      summary.stderr[1],
      `ERROR ${Code.EVIDENCE_WRITE_FAILED}`,
    );
  });

  it("does not retry the artifact writer that caused the primary failure", async () => {
    let evidenceCalls = 0;
    const evidenceFailure = harness();
    assertEquals(
      await runBuildVerificationCli(
        ["--wasm", "target.wasm", "--evidence", "evidence.json"],
        evidenceFailure.io,
        {
          createVerifier: () => ({ verify: () => Promise.resolve(result()) }),
          writeEvidence: () => {
            evidenceCalls += 1;
            return Promise.reject(
              new EvidenceWriteFailedError("evidence.json", new Error("write")),
            );
          },
        },
      ),
      BuildVerificationCliExitCode.Failed,
    );
    assertEquals(evidenceCalls, 1);
    assertStringIncludes(
      evidenceFailure.stderr[0],
      `ERROR ${Code.EVIDENCE_WRITE_FAILED}`,
    );

    let logCalls = 0;
    const logFailure = harness();
    assertEquals(
      await runBuildVerificationCli(
        ["--wasm", "target.wasm", "--logs", "logs.jsonl"],
        logFailure.io,
        {
          createVerifier: () => ({ verify: () => Promise.resolve(result()) }),
          writeLogs: () => {
            logCalls += 1;
            return Promise.reject(
              new LogWriteFailedError("logs.jsonl", new Error("write")),
            );
          },
        },
      ),
      BuildVerificationCliExitCode.Failed,
    );
    assertEquals(logCalls, 1);
    assertStringIncludes(
      logFailure.stderr[0],
      `ERROR ${Code.LOG_WRITE_FAILED}`,
    );
  });

  it("builds bounded failure reports from context or fallback evidence", () => {
    const event: VerificationLogEvent = {
      timestamp: "2026-09-01T12:00:00.000Z",
      stage: "execute-contract-build",
      level: "error",
      code: "BLDV_BUILD_FAILED",
      message: "Build failed.",
    };
    const evidence = { ...testEvidence(), logs: [event] };
    const contextual = buildVerificationFailureReport(
      attachBuildVerificationErrorContext(
        new DockerUnavailableError(new Error("offline")),
        { evidence, logs: [event] },
      ),
    );
    assertEquals(contextual.evidence, evidence);
    assertEquals(contextual.logs, [event]);
    assertEquals(
      (contextual.error.meta as { data: Record<string, unknown> }).data
        .evidence,
      undefined,
    );
    assertEquals(
      (contextual.error.meta as { data: Record<string, unknown> }).data.logs,
      undefined,
    );
    const fallback = buildVerificationFailureReport(
      new CliUnexpectedFailureError("unexpected"),
      evidence,
    );
    assertEquals(fallback.evidence, evidence);
    assertEquals(fallback.logs, [event]);
    const empty = buildVerificationFailureReport(
      new CliUnexpectedFailureError("unexpected"),
    );
    assertEquals(empty.evidence, undefined);
    assertEquals(empty.logs, []);
    const noData = buildVerificationFailureReport(ColibriError.unexpected());
    assertEquals(noData.evidence, undefined);
    assertEquals(noData.logs, []);

    const invalidContexts = [
      { evidence: "invalid" },
      { evidence: {} },
      { evidence: { package: {} } },
    ];
    for (const data of invalidContexts) {
      const invalidContext = ColibriError.unexpected({ meta: { data } });
      const report = buildVerificationFailureReport(invalidContext);
      assertEquals(report.evidence, undefined);
      assertEquals(report.logs, []);
    }

    const missingSerializedMeta = ColibriError.unexpected({
      meta: { data: { safe: true } },
    });
    missingSerializedMeta.toJSON = () => ({ code: "TEST" });
    assertEquals(
      buildVerificationFailureReport(missingSerializedMeta).error,
      { code: "TEST" },
    );
    for (const serializedData of [undefined, "invalid", []] as const) {
      const invalidSerializedData = ColibriError.unexpected({
        meta: { data: { safe: true } },
      });
      invalidSerializedData.toJSON = () => ({
        code: "TEST",
        meta: { data: serializedData },
      });
      assertEquals(
        buildVerificationFailureReport(invalidSerializedData).error.code,
        "TEST",
      );
    }
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
      BuildVerificationCliExitCode.Verified,
    );
    assertEquals(JSON.parse(test.stdout[0]), result());
  });

  it("uses the default verifier for a strict local contract without metadata", async () => {
    const test = harness();
    assertEquals(
      await runBuildVerificationCli(["--wasm", "target.wasm"], test.io),
      BuildVerificationCliExitCode.NotApplicable,
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
      assertEquals(
        typeof DEFAULT_BUILD_VERIFICATION_CLI_IO.stderrIsTerminal?.(),
        "boolean",
      );
      assertEquals(
        typeof DEFAULT_BUILD_VERIFICATION_CLI_IO.stderrWrite,
        "function",
      );
      DEFAULT_BUILD_VERIFICATION_CLI_IO.stderrWrite?.("");
      assertEquals(
        await runBuildVerificationCli(["--help"]),
        BuildVerificationCliExitCode.Verified,
      );
      assertEquals(
        await runBuildVerificationCli(["invalid"]),
        BuildVerificationCliExitCode.Failed,
      );
      assertStringIncludes(String(stdout[0]), "@colibri/build-verification");
      assertStringIncludes(String(stderr[0]), "ERROR BLDV_106");
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  });
});
