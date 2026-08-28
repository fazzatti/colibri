import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import Dockerode from "dockerode";
import {
  type ContractBuildRecipe,
  ContractBuildVerifier,
  createContractBuildArguments,
  DEFAULT_BUILD_VERIFICATION_LIMITS,
  DefaultVerificationArchiveExtractor,
  DockerBuildRunner,
  extractContractMetadata,
  OciContainerImageResolver,
  parseSep58Recipe,
} from "../mod.ts";
import {
  BuildCommandFailedError,
  BuildTimedOutError,
} from "./runners/docker/error.ts";
import { resolveDockerOptions } from "./runners/docker/connection.ts";

const FIXTURE_ROOT = new URL(
  "../../_internal/build-verification/fixtures/",
  import.meta.url,
);
const RUNNER_LABEL = "dev.colibri.build-verification.runner=1";
const SUITE_RUNNER_LABEL_KEY =
  "dev.colibri.build-verification.docker-integration";
const SUITE_RUNNER_LABEL_VALUE = crypto.randomUUID();
const SUITE_RUNNER_LABEL =
  `${SUITE_RUNNER_LABEL_KEY}=${SUITE_RUNNER_LABEL_VALUE}`;
const V1_HASH =
  "3abb668393605a6f711a82a282bdadec5d9a61a5aa4f7808d32a704839bf40bd";
const V2_HASH =
  "243831b6473ef3fe61d3563cbd07d09947369b98d34c514854389efc7a1df721";
const limits = Object.freeze({
  ...DEFAULT_BUILD_VERIFICATION_LIMITS,
  timeoutMs: 5 * 60 * 1000,
});

const directories: string[] = [];
let sourceArchive: Uint8Array;
let v1Wasm: Uint8Array;
let v2Wasm: Uint8Array;
let v1Recipe: ContractBuildRecipe;

const docker = new Dockerode(resolveDockerOptions());
const labeledDocker = new Proxy(docker, {
  get(target, property) {
    if (property === "createContainer") {
      return (options: Dockerode.ContainerCreateOptions) =>
        target.createContainer({
          ...options,
          Labels: {
            ...options.Labels,
            [SUITE_RUNNER_LABEL_KEY]: SUITE_RUNNER_LABEL_VALUE,
          },
        });
    }
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
const runner = DockerBuildRunner.fromDockerClient(labeledDocker);

const runnerContainers = async (): Promise<readonly string[]> =>
  (await docker.listContainers({
    all: true,
    filters: { label: [RUNNER_LABEL, SUITE_RUNNER_LABEL] },
  })).map(({ Id }) => Id).sort();

const extractedSource = async (): Promise<string> => {
  const workspaceDirectory = await Deno.makeTempDir({
    prefix: "colibri-build-verification-docker-integration-",
  });
  directories.push(workspaceDirectory);
  return (await new DefaultVerificationArchiveExtractor().extract({
    source: {
      content: "archive",
      kind: "archive",
      bytes: sourceArchive,
      name: "upgradeable-source.tar",
      format: "tar",
      size: sourceArchive.length,
      sha256: v1Recipe.sourceSha256!,
    },
    workspaceDirectory,
    limits,
  })).sourceDirectory;
};

const exactPlan = async (overrides: {
  readonly allowNetwork?: boolean;
  readonly arguments?: readonly string[];
  readonly timeoutMs?: number;
} = {}) => ({
  sourceDirectory: await extractedSource(),
  image: await new OciContainerImageResolver().resolve(v1Recipe.image),
  arguments: overrides.arguments ?? createContractBuildArguments(v1Recipe),
  rustupToolchain: "1.95.0",
  allowNetwork: overrides.allowNetwork ?? false,
  limits: {
    ...limits,
    timeoutMs: overrides.timeoutMs ?? limits.timeoutMs,
  },
});

beforeAll(async () => {
  [sourceArchive, v1Wasm, v2Wasm] = await Promise.all([
    Deno.readFile(new URL("upgradeable-source.tar", FIXTURE_ROOT)),
    Deno.readFile(new URL("upgradeable-v1.wasm", FIXTURE_ROOT)),
    Deno.readFile(new URL("upgradeable-v2.wasm", FIXTURE_ROOT)),
  ]);
  v1Recipe = parseSep58Recipe(extractContractMetadata(v1Wasm))!;
});

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await Deno.remove(directory, { recursive: true }).catch(() => undefined);
  }
  assertEquals(
    await runnerContainers(),
    [],
    "every success and failure path must remove its labeled build container",
  );
});

describe("DockerBuildRunner integration", disableSanitizeConfig, () => {
  it("denies dependency retrieval by default and retains bounded failure logs", async () => {
    const error = await assertRejects(
      async () => await runner.run(await exactPlan()),
      BuildCommandFailedError,
    );
    assert(
      typeof error.meta?.data.exitCode === "number" &&
        error.meta.data.exitCode > 0,
      "the real isolated build must report a non-zero container exit",
    );
    assert(
      String(error.meta?.data.stderr).includes("failed to download") ||
        String(error.meta?.data.stderr).includes("Could not resolve") ||
        String(error.meta?.data.stderr).includes("network is unreachable"),
      "the real offline build must fail while retrieving a locked dependency",
    );
  });

  it("replays the exact command with explicit network access and captures one selected artifact", async () => {
    const result = await new ContractBuildVerifier({
      allowBuildNetwork: true,
      limits: { timeoutMs: limits.timeoutMs },
      runner,
    }).verify({
      target: { wasm: v1Wasm, label: "upgradeable fixture v1" },
      source: {
        type: "archive",
        bytes: sourceArchive,
        name: "upgradeable-source.tar",
      },
    });

    assertEquals(result.status, "verified");
    assertEquals(result.evidence.execution?.networkEnabled, true);
    assertEquals(
      result.evidence.execution?.arguments,
      createContractBuildArguments(v1Recipe),
    );
    assertEquals(result.evidence.execution?.candidates.length, 1);
    assertEquals(
      result.evidence.execution?.candidates[0]?.path,
      "target/wasm32v1-none/release/build_verification_upgradeable_contract.wasm",
    );
    assertEquals(result.evidence.artifact?.sha256, V1_HASH);
    assertEquals(result.evidence.target?.wasmHash, V1_HASH);
    assertEquals(result.evidence.comparison?.equal, true);
    assert(
      (result.evidence.execution?.stderr.length ?? 0) > 0,
      "real compiler output must be retained as bounded build evidence",
    );
  });

  it("returns mismatch only after a successful real build and raw-byte comparison", async () => {
    const v2Recipe = parseSep58Recipe(extractContractMetadata(v2Wasm))!;
    const result = await new ContractBuildVerifier({
      allowBuildNetwork: true,
      limits: { timeoutMs: limits.timeoutMs },
      runner,
    }).verify({
      mode: "outOfBand",
      target: { wasm: v1Wasm, label: "v1 compared with v2 recipe" },
      source: {
        type: "archive",
        bytes: sourceArchive,
        name: "upgradeable-source.tar",
      },
      recipe: v2Recipe,
    });

    assertEquals(result.status, "mismatch");
    assertEquals(result.evidence.comparison?.equal, false);
    assertEquals(result.evidence.artifact?.sha256, V2_HASH);
    assertEquals(result.evidence.target?.wasmHash, V1_HASH);
  });

  it("classifies non-zero and timeout failures and cleans both containers", async () => {
    await assertRejects(
      async () =>
        await runner.run(
          await exactPlan({
            allowNetwork: true,
            arguments: [
              "contract",
              "build",
              "--package=missing-build-verification-package",
            ],
          }),
        ),
      BuildCommandFailedError,
    );
    assertEquals(await runnerContainers(), []);

    const timeout = await assertRejects(
      async () =>
        await runner.run(
          await exactPlan({
            allowNetwork: true,
            timeoutMs: 1,
          }),
        ),
      BuildTimedOutError,
    );
    assertEquals(timeout.meta?.data.timeoutMs, 1);
  });
});
