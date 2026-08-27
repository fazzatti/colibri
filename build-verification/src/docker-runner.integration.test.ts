import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { cp } from "node:fs/promises";
import { assertEquals, assertRejects } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { DockerBuildRunner } from "@/docker-runner.ts";
import * as E from "@/error.ts";
import { ContractBuildVerifier } from "@/verifier.ts";
import { DEFAULT_BUILD_VERIFICATION_LIMITS } from "@/types.ts";
import type { ContractBuildRecipe, ContractBuildRunnerInput } from "@/types.ts";

const STELLAR_CLI_IMAGE =
  "docker.io/stellar/stellar-cli@sha256:a63366ef5fcd709759994f9f9109b68144f7158abd68e97421357fa8932df78d";
const ALPINE_IMAGE =
  "docker.io/library/alpine@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc";
const fixture =
  new URL("../../_internal/contracts/delegated-asset-account", import.meta.url)
    .pathname;
const directories: string[] = [];

const copyFixture = async (): Promise<string> => {
  const directory = await Deno.makeTempDir({
    prefix: "colibri-build-runner-test-",
  });
  directories.push(directory);
  await cp(fixture, directory, { recursive: true });
  const manifest = `${directory}/Cargo.toml`;
  await Deno.writeTextFile(
    manifest,
    `${await Deno.readTextFile(
      manifest,
    )}\n[profile.release]\noverflow-checks = true\n`,
  );
  return directory;
};

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await Deno.remove(directory, { recursive: true });
  }
});

const recipe = (
  overrides: Partial<ContractBuildRecipe> = {},
): ContractBuildRecipe => ({
  image: STELLAR_CLI_IMAGE,
  arguments: ["contract", "build"],
  options: ["--package=delegated-asset-account-contract"],
  metadata: [],
  ...overrides,
});

const input = async (
  overrides: Partial<ContractBuildRunnerInput> = {},
): Promise<ContractBuildRunnerInput> => ({
  sourceDirectory: await copyFixture(),
  recipe: recipe(),
  allowNetwork: true,
  limits: { ...DEFAULT_BUILD_VERIFICATION_LIMITS, timeoutMs: 5 * 60 * 1000 },
  ...overrides,
});

describe("DockerBuildRunner integration", disableSanitizeConfig, () => {
  it("rebuilds a real Soroban contract and verifies it end to end", async () => {
    const runner = new DockerBuildRunner();
    const first = await runner.run(await input());
    const cleanSource = await copyFixture();
    const result = await new ContractBuildVerifier({
      allowBuildNetwork: true,
      limits: { timeoutMs: 5 * 60 * 1000 },
    }).verify({
      mode: "outOfBand",
      target: { wasm: first.wasm },
      source: { type: "path", path: cleanSource },
      recipe: {
        image: STELLAR_CLI_IMAGE,
        options: ["--package=delegated-asset-account-contract"],
      },
    });
    assertEquals(result.status, "verified");
  });

  it("reports daemon, image-runtime, command, artifact, and timeout failures", async () => {
    await assertRejects(
      async () =>
        await new DockerBuildRunner({
          dockerSocketPath: "/tmp/colibri-missing-docker.sock",
        }).run(await input()),
      E.DockerUnavailableError,
    );
    await assertRejects(
      async () =>
        await new DockerBuildRunner().run(
          await input({ recipe: recipe({ image: ALPINE_IMAGE }) }),
        ),
      E.ImageRuntimeMismatchError,
    );
    await assertRejects(
      async () =>
        await new DockerBuildRunner().run(
          await input({
            recipe: recipe({ arguments: ["not-a-command"], options: [] }),
          }),
        ),
      E.BuildCommandFailedError,
    );
    await assertRejects(
      async () =>
        await new DockerBuildRunner().run(
          await input({
            recipe: recipe({ arguments: ["version"], options: [] }),
          }),
        ),
      E.BuildArtifactNotFoundError,
    );
    await assertRejects(
      async () =>
        await new DockerBuildRunner().run(
          await input({
            limits: { ...DEFAULT_BUILD_VERIFICATION_LIMITS, timeoutMs: 1 },
          }),
        ),
      E.BuildTimedOutError,
    );
  });
});
