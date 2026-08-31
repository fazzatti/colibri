import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { plugin } from "convee";
import type {
  ResolveBuildImageInput,
  ResolveBuildImageOutput,
} from "@/processes/index.ts";
import { BUILD_VERIFICATION_PIPELINE_ID } from "@/pipelines/build-verification/index.ts";
import { pipelineTestDependencies } from "@/pipelines/build-verification/testing.test.ts";
import { RESOLVE_BUILD_IMAGE_STEP_ID } from "@/steps/ids.ts";
import { TEST_LIMITS, testWasm } from "@/testing.test.ts";
import { DEFAULT_BUILD_VERIFICATION_LIMITS } from "@/core/types/limits.ts";
import { InvalidVerifierOptionsError } from "@/error/core.ts";
import { DefaultVerificationArchiveExtractor } from "@/archive/extract.ts";
import { DefaultBuildArtifactCollector } from "@/artifacts/collect.ts";
import { OciContainerImageResolver } from "@/providers/image/oci.ts";
import { DefaultVerificationSourceProvider } from "@/providers/source/router.ts";
import { DefaultVerificationTargetResolver } from "@/providers/target/default.ts";
import { DockerBuildRunner } from "@/runners/docker/runner.ts";
import { NetworkConfig } from "@colibri/core";
import { ContractBuildVerifier } from "@/verifier/contract-build-verifier.ts";
import {
  createDefaultBuildVerificationDependencies,
  normalizeBuildVerificationLimits,
} from "@/verifier/defaults.ts";
import { verifyContractBuild } from "@/verifier/function.ts";
import type { ContractBuildVerifierOptions } from "@/verifier/types.ts";

const request = () => ({
  mode: "outOfBand" as const,
  target: { wasm: testWasm() },
  source: {
    type: "archive" as const,
    bytes: new Uint8Array([1, 2, 3]),
    name: "source.tar",
    format: "tar" as const,
  },
  recipe: {
    image: `docker.io/stellar/stellar-cli@sha256:${"a".repeat(64)}`,
  },
});

const verifierOptions = (
  overrides: ContractBuildVerifierOptions = {},
): ContractBuildVerifierOptions => {
  const dependencies = pipelineTestDependencies();
  return {
    targetResolver: dependencies.targetResolver,
    sourceProvider: dependencies.sourceProvider,
    imageResolver: dependencies.imageResolver,
    archiveExtractor: dependencies.archiveExtractor,
    artifactCollector: dependencies.artifactCollector,
    runner: dependencies.runner,
    policy: {
      image: dependencies.imagePolicy,
      command: dependencies.commandPolicy,
      options: dependencies.optionPolicy,
    },
    allowBuildNetwork: dependencies.allowBuildNetwork,
    limits: TEST_LIMITS,
    workspace: dependencies.workspace,
    now: dependencies.now,
    ...overrides,
  };
};

describe("ContractBuildVerifier", () => {
  it("merges partial limits into immutable positive defaults", () => {
    const limits = normalizeBuildVerificationLimits({ maxFiles: 7 });
    assertEquals(limits.maxFiles, 7);
    assertEquals(
      limits.maxArchiveBytes,
      DEFAULT_BUILD_VERIFICATION_LIMITS.maxArchiveBytes,
    );
    assertEquals(Object.isFrozen(limits), true);
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assertThrows(
        () => normalizeBuildVerificationLimits({ maxFiles: value }),
        InvalidVerifierOptionsError,
      );
    }
  });

  it("creates every default adapter without eagerly performing external I/O", () => {
    const dependencies = createDefaultBuildVerificationDependencies();
    assertEquals(
      dependencies.targetResolver instanceof DefaultVerificationTargetResolver,
      true,
    );
    assertEquals(
      dependencies.sourceProvider instanceof DefaultVerificationSourceProvider,
      true,
    );
    assertEquals(
      dependencies.imageResolver instanceof OciContainerImageResolver,
      true,
    );
    assertEquals(
      dependencies.archiveExtractor instanceof
        DefaultVerificationArchiveExtractor,
      true,
    );
    assertEquals(
      dependencies.artifactCollector instanceof DefaultBuildArtifactCollector,
      true,
    );
    assertEquals(dependencies.runner instanceof DockerBuildRunner, true);
    assertEquals(dependencies.allowBuildNetwork, false);
    assertEquals(dependencies.networkEvidence, undefined);
    assertEquals(dependencies.logging, undefined);
  });

  it("preserves injected boundaries, policies, logging, and explicit network flag", () => {
    const options = verifierOptions({
      allowBuildNetwork: true,
      logger: { log: () => {} },
      strictLogger: true,
    });
    const dependencies = createDefaultBuildVerificationDependencies(options);
    assertStrictEquals(dependencies.targetResolver, options.targetResolver);
    assertStrictEquals(dependencies.sourceProvider, options.sourceProvider);
    assertStrictEquals(dependencies.imageResolver, options.imageResolver);
    assertStrictEquals(dependencies.archiveExtractor, options.archiveExtractor);
    assertStrictEquals(
      dependencies.artifactCollector,
      options.artifactCollector,
    );
    assertStrictEquals(dependencies.runner, options.runner);
    assertEquals(dependencies.allowBuildNetwork, true);
    assertStrictEquals(dependencies.logging?.logger, options.logger);
    assertEquals(dependencies.logging?.strict, true);
  });

  it("normalizes a configured Colibri network for default target resolution", () => {
    const dependencies = createDefaultBuildVerificationDependencies({
      network: { networkConfig: NetworkConfig.TestNet() },
    });
    assertEquals(dependencies.networkEvidence, {
      input: "networkConfig",
      networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
      rpcUrl: NetworkConfig.TestNet().rpcUrl,
      allowHttp: NetworkConfig.TestNet().allowHttp,
    });
  });

  it("rejects invalid boolean options before pipeline construction", () => {
    assertThrows(
      () =>
        createDefaultBuildVerificationDependencies(
          { allowBuildNetwork: "yes" } as never,
        ),
      InvalidVerifierOptionsError,
    );
    assertThrows(
      () =>
        createDefaultBuildVerificationDependencies(
          { strictLogger: 1 } as never,
        ),
      InvalidVerifierOptionsError,
    );
  });

  it("exposes the composable pipeline and delegates reusable verification", async () => {
    const verifier = new ContractBuildVerifier(verifierOptions());
    assertEquals(verifier.verificationPipe.id, BUILD_VERIFICATION_PIPELINE_ID);
    assertEquals((await verifier.verify(request())).status, "verified");
  });

  it("installs caller plugins in order on stable process targets", async () => {
    const calls: string[] = [];
    const makePlugin = (id: string) =>
      plugin.for<
        [ResolveBuildImageInput],
        ResolveBuildImageOutput
      >()({
        output: (output) => {
          calls.push(id);
          return output;
        },
      }, { id, target: RESOLVE_BUILD_IMAGE_STEP_ID });
    const first = makePlugin("first");
    const second = makePlugin("second");
    const verifier = new ContractBuildVerifier(verifierOptions({
      plugins: [first, second],
    }));
    assertEquals((await verifier.verify(request())).status, "verified");
    assertEquals(calls, ["first", "second"]);
    assertEquals(verifier.verificationPipe.plugins.map(({ id }) => id), [
      "first",
      "second",
    ]);
  });

  it("supports the one-shot function through the same pipeline composition", async () => {
    assertEquals(
      (await verifyContractBuild(request(), verifierOptions())).status,
      "verified",
    );
  });
});
