import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ConveeError, plugin } from "convee";
import type {
  ResolveBuildImageInput,
  ResolveBuildImageOutput,
} from "@/processes/index.ts";
import { MissingTargetNetworkError } from "@/providers/target/error.ts";
import {
  TEST_LIMITS,
  TEST_NOW,
  testWasm,
  testWasmWithMetadata,
} from "@/testing.test.ts";
import {
  COMPARE_CONTRACT_WASM_STEP_ID,
  EXECUTE_CONTRACT_BUILD_STEP_ID,
  PARSE_CONTRACT_METADATA_STEP_ID,
  RESOLVE_BUILD_IMAGE_STEP_ID,
  RESOLVE_SOURCE_ARCHIVE_STEP_ID,
  RESOLVE_VERIFICATION_TARGET_STEP_ID,
  SELECT_BUILD_ARTIFACT_STEP_ID,
  VALIDATE_BUILD_RECIPE_STEP_ID,
} from "@/steps/ids.ts";
import {
  ARTIFACT_TO_COMPARISON_CONNECTOR_ID,
  EXECUTION_TO_ARTIFACT_CONNECTOR_ID,
  IMAGE_TO_EXECUTION_CONNECTOR_ID,
  INPUT_TO_RESOLVE_TARGET_CONNECTOR_ID,
  METADATA_TO_RECIPE_CONNECTOR_ID,
  RECIPE_TO_SOURCE_CONNECTOR_ID,
  SOURCE_TO_IMAGE_CONNECTOR_ID,
  TARGET_TO_METADATA_CONNECTOR_ID,
} from "@/pipelines/build-verification/connectors.ts";
import {
  BuildVerificationPipelineConstructionError,
  ProcessDependencyMissingError,
} from "@/pipelines/build-verification/error.ts";
import {
  BUILD_VERIFICATION_PIPELINE_ID,
  createBuildVerificationPipeline,
} from "@/pipelines/build-verification/index.ts";
import { pipelineTestDependencies } from "@/pipelines/build-verification/testing.test.ts";

const request = () => ({
  mode: "outOfBand" as const,
  target: { wasm: testWasm(), label: "fixture" },
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

describe("BuildVerificationPipeline", () => {
  it("has the exact stable pipeline, connector, and process-step order", () => {
    const pipeline = createBuildVerificationPipeline(
      pipelineTestDependencies(),
    );
    assertEquals(pipeline.id, BUILD_VERIFICATION_PIPELINE_ID);
    assertEquals(pipeline.steps.map(({ id }) => id), [
      INPUT_TO_RESOLVE_TARGET_CONNECTOR_ID,
      RESOLVE_VERIFICATION_TARGET_STEP_ID,
      TARGET_TO_METADATA_CONNECTOR_ID,
      PARSE_CONTRACT_METADATA_STEP_ID,
      METADATA_TO_RECIPE_CONNECTOR_ID,
      VALIDATE_BUILD_RECIPE_STEP_ID,
      RECIPE_TO_SOURCE_CONNECTOR_ID,
      RESOLVE_SOURCE_ARCHIVE_STEP_ID,
      SOURCE_TO_IMAGE_CONNECTOR_ID,
      RESOLVE_BUILD_IMAGE_STEP_ID,
      IMAGE_TO_EXECUTION_CONNECTOR_ID,
      EXECUTE_CONTRACT_BUILD_STEP_ID,
      EXECUTION_TO_ARTIFACT_CONNECTOR_ID,
      SELECT_BUILD_ARTIFACT_STEP_ID,
      ARTIFACT_TO_COMPARISON_CONNECTOR_ID,
      COMPARE_CONTRACT_WASM_STEP_ID,
    ]);
  });

  it("executes every injected boundary once in dependency order", async () => {
    const calls: string[] = [];
    const base = pipelineTestDependencies();
    const dependencies = pipelineTestDependencies({
      targetResolver: {
        resolve: (input) => {
          calls.push("target");
          assertEquals(input.target, request().target);
          return base.targetResolver.resolve(input);
        },
      },
      commandPolicy: {
        evaluate: (arguments_) => {
          calls.push("command-policy");
          assertEquals(arguments_, ["contract", "build"]);
          return base.commandPolicy.evaluate(arguments_);
        },
      },
      optionPolicy: {
        evaluate: (options, arguments_) => {
          calls.push("option-policy");
          assertEquals([options, arguments_], [[], ["contract", "build"]]);
          return base.optionPolicy.evaluate(options, arguments_);
        },
      },
      sourceProvider: {
        resolve: (input) => {
          calls.push("source");
          return base.sourceProvider.resolve(input);
        },
      },
      imageResolver: {
        resolve: (reference) => {
          calls.push("image");
          return base.imageResolver.resolve(reference);
        },
      },
      imagePolicy: {
        evaluateReference: (reference) => {
          calls.push("image-reference-policy");
          return base.imagePolicy.evaluateReference(reference);
        },
        evaluate: (image) => {
          calls.push("image-policy");
          return base.imagePolicy.evaluate(image);
        },
      },
      workspace: {
        makeTempDir: () => {
          calls.push("workspace");
          return Promise.resolve("/workspace");
        },
        remove: () => {
          calls.push("cleanup");
          return Promise.resolve();
        },
      },
      archiveExtractor: {
        extract: (input) => {
          calls.push("extract");
          return base.archiveExtractor.extract(input);
        },
      },
      artifactCollector: {
        snapshot: (directory, limits) => {
          calls.push("snapshot");
          return base.artifactCollector.snapshot(directory, limits);
        },
        collect: (directory, before, limits) => {
          calls.push("collect");
          return base.artifactCollector.collect(directory, before, limits);
        },
      },
      runner: {
        run: (plan) => {
          calls.push("runner");
          assertEquals(plan.allowNetwork, false);
          return base.runner.run(plan);
        },
      },
    });
    const result = await createBuildVerificationPipeline(dependencies).run(
      request(),
    );
    assertEquals(result.status, "verified");
    assertEquals(calls, [
      "target",
      "command-policy",
      "option-policy",
      "source",
      "image-reference-policy",
      "image",
      "image-policy",
      "workspace",
      "extract",
      "snapshot",
      "runner",
      "collect",
      "cleanup",
    ]);
    assertEquals(result.evidence.logs.map(({ stage }) => stage), [
      "resolve-verification-target",
      "resolve-verification-target",
      "parse-contract-metadata",
      "validate-build-recipe",
      "resolve-source-archive",
      "resolve-build-image",
      "execute-contract-build",
      "select-build-artifact",
      "compare-contract-wasm",
    ]);
  });

  it("returns mismatch as a completed result rather than an operational error", async () => {
    const base = pipelineTestDependencies();
    const pipeline = createBuildVerificationPipeline(pipelineTestDependencies({
      artifactCollector: {
        snapshot: base.artifactCollector.snapshot,
        collect: () =>
          Promise.resolve([{
            path: "/workspace/source/target/wasm32v1-none/release/fixture.wasm",
            bytes: new Uint8Array([1, 2, 3]),
            size: 3,
            sha256: "different",
          }]),
      },
    }));
    assertEquals((await pipeline.run(request())).status, "mismatch");
  });

  it("runs strict SEP-58 metadata as the authoritative recipe", async () => {
    const sourceHash = "c".repeat(64);
    const wasm = testWasmWithMetadata([
      { key: "cliver", value: "22.0.0" },
      { key: "bldimg", value: request().recipe.image },
      { key: "bldarg", value: "contract" },
      { key: "bldarg", value: "build" },
      { key: "source_uri", value: "https://example.com/source.tar" },
      { key: "source_sha256", value: sourceHash },
    ]);
    const base = pipelineTestDependencies();
    const pipeline = createBuildVerificationPipeline(pipelineTestDependencies({
      targetResolver: {
        resolve: () =>
          Promise.resolve({
            applicability: "wasm",
            kind: "wasm",
            wasm,
            wasmHash: "strict-target-hash",
            observedAt: TEST_NOW,
          }),
      },
      sourceProvider: {
        resolve: (input) => {
          assertEquals(input.source, {
            type: "url",
            url: "https://example.com/source.tar",
          });
          return Promise.resolve({
            content: "archive",
            kind: "metadataUrl",
            bytes: new Uint8Array([1]),
            name: "source.tar",
            format: "tar",
            requestedLocator: "https://example.com/source.tar",
            size: 1,
            sha256: sourceHash,
          });
        },
      },
      artifactCollector: {
        snapshot: base.artifactCollector.snapshot,
        collect: () =>
          Promise.resolve([{
            path: "/workspace/source/target/wasm32v1-none/release/fixture.wasm",
            bytes: wasm,
            size: wasm.length,
            sha256: "strict-artifact-hash",
          }]),
      },
    }));
    const result = await pipeline.run({ target: { wasm } });
    assertEquals(result.status, "verified");
    assertEquals(result.evidence.mode, "strictSep58");
    assertEquals(result.evidence.recipeProvenance, "onChainSep58Metadata");
  });

  it("carries terminal not-applicable state through every later step", async () => {
    let laterBoundaryCalled = false;
    const base = pipelineTestDependencies();
    const sourceProvider = {
      resolve: () => {
        laterBoundaryCalled = true;
        return base.sourceProvider.resolve({
          source: request().source,
          strict: false,
          limits: TEST_LIMITS,
        });
      },
    };
    const sac = createBuildVerificationPipeline(pipelineTestDependencies({
      targetResolver: {
        resolve: () =>
          Promise.resolve({
            applicability: "stellarAssetContract",
            kind: "contractId",
            contractId:
              "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
            observedAt: TEST_NOW,
          }),
      },
      sourceProvider,
    }));
    const sacResult = await sac.run({
      target: {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
      },
    });
    assertEquals(sacResult.status, "notApplicable");
    if (sacResult.status === "notApplicable") {
      assertEquals(sacResult.reason, "stellarAssetContract");
    }
    assertEquals(laterBoundaryCalled, false);

    const missing = createBuildVerificationPipeline(pipelineTestDependencies({
      sourceProvider,
    }));
    const missingResult = await missing.run({ target: { wasm: testWasm() } });
    assertEquals(missingResult.status, "notApplicable");
    if (missingResult.status === "notApplicable") {
      assertEquals(missingResult.reason, "missingSep58Metadata");
    }
    assertEquals(laterBoundaryCalled, false);
  });

  it("supports plugins targeted to stable process-step ids", async () => {
    const calls: string[] = [];
    const imagePlugin = plugin.for<
      [ResolveBuildImageInput],
      ResolveBuildImageOutput
    >()({
      output: (output) => {
        calls.push("image-output");
        return output;
      },
    }, {
      id: "test-image-plugin",
      target: RESOLVE_BUILD_IMAGE_STEP_ID,
    });
    const pipeline = createBuildVerificationPipeline(
      pipelineTestDependencies(),
    );
    pipeline.use(imagePlugin);
    const result = await pipeline.run(request());
    assertEquals(result.status, "verified");
    assertEquals(calls, ["image-output"]);
    assertEquals(pipeline.plugins.map(({ id }) => id), ["test-image-plugin"]);
    pipeline.remove("test-image-plugin");
    assertEquals(pipeline.plugins, []);
  });

  it("runs plugins on every stable process target and the pipeline target", async () => {
    const calls: string[] = [];
    const pipeline = createBuildVerificationPipeline(
      pipelineTestDependencies(),
    );
    for (
      const target of [
        RESOLVE_VERIFICATION_TARGET_STEP_ID,
        PARSE_CONTRACT_METADATA_STEP_ID,
        VALIDATE_BUILD_RECIPE_STEP_ID,
        RESOLVE_SOURCE_ARCHIVE_STEP_ID,
        RESOLVE_BUILD_IMAGE_STEP_ID,
        EXECUTE_CONTRACT_BUILD_STEP_ID,
        SELECT_BUILD_ARTIFACT_STEP_ID,
        COMPARE_CONTRACT_WASM_STEP_ID,
      ]
    ) {
      pipeline.use(
        plugin({ id: `plugin-${target}`, target })
          .onOutput((output: unknown) => {
            calls.push(target);
            return output;
          }) as never,
      );
    }
    pipeline.use(
      plugin({ id: "pipeline-plugin", target: BUILD_VERIFICATION_PIPELINE_ID })
        .onOutput((output: unknown) => {
          calls.push(BUILD_VERIFICATION_PIPELINE_ID);
          return output;
        }) as never,
    );
    assertEquals((await pipeline.run(request())).status, "verified");
    assertEquals(calls, [
      RESOLVE_VERIFICATION_TARGET_STEP_ID,
      PARSE_CONTRACT_METADATA_STEP_ID,
      VALIDATE_BUILD_RECIPE_STEP_ID,
      RESOLVE_SOURCE_ARCHIVE_STEP_ID,
      RESOLVE_BUILD_IMAGE_STEP_ID,
      EXECUTE_CONTRACT_BUILD_STEP_ID,
      SELECT_BUILD_ARTIFACT_STEP_ID,
      COMPARE_CONTRACT_WASM_STEP_ID,
      BUILD_VERIFICATION_PIPELINE_ID,
    ]);
  });

  it("rejects unknown plugin targets through Convee", () => {
    const pipeline = createBuildVerificationPipeline(
      pipelineTestDependencies(),
    );
    const unknown = plugin({ id: "unknown", target: "not-a-step" })
      .onOutput((output: unknown) => output);
    assertThrows(() => pipeline.use(unknown as never), ConveeError);
  });

  it("preserves typed process errors through the pipeline", async () => {
    await assertRejects(
      () =>
        createBuildVerificationPipeline(pipelineTestDependencies({
          targetResolver: {
            resolve: () => Promise.reject(new MissingTargetNetworkError()),
          },
        })).run(request()),
      MissingTargetNetworkError,
    );
  });

  it("validates every required pipeline dependency", () => {
    const required = [
      "targetResolver",
      "sourceProvider",
      "imageResolver",
      "imagePolicy",
      "commandPolicy",
      "optionPolicy",
      "archiveExtractor",
      "runner",
      "artifactCollector",
      "allowBuildNetwork",
      "limits",
    ] as const;
    for (const name of required) {
      const dependencies = { ...pipelineTestDependencies(), [name]: undefined };
      const error = assertThrows(
        () => createBuildVerificationPipeline(dependencies as never),
        ProcessDependencyMissingError,
      );
      assertEquals(error.meta?.data.dependency, name);
    }
  });

  it("normalizes unexpected pipeline-construction failures once", () => {
    const dependencies = new Proxy(pipelineTestDependencies(), {
      get: () => {
        throw new Error("unexpected getter");
      },
    });
    assertThrows(
      () => createBuildVerificationPipeline(dependencies),
      BuildVerificationPipelineConstructionError,
    );
  });
});
