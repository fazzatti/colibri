import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createRunContext, step, type StepThis } from "convee";
import {
  artifactProcessState,
  executionProcessState,
  imageProcessState,
  metadataProcessState,
  processRequest,
  recipeProcessState,
  sourceProcessState,
  targetProcessState,
} from "../../processes/testing.test.ts";
import {
  EXECUTE_CONTRACT_BUILD_STEP_ID,
  PARSE_CONTRACT_METADATA_STEP_ID,
  RESOLVE_BUILD_IMAGE_STEP_ID,
  RESOLVE_SOURCE_ARCHIVE_STEP_ID,
  RESOLVE_VERIFICATION_TARGET_STEP_ID,
  SELECT_BUILD_ARTIFACT_STEP_ID,
  VALIDATE_BUILD_RECIPE_STEP_ID,
} from "../../steps/ids.ts";
import type {
  ExecuteContractBuildOutput,
  ParseContractMetadataOutput,
  ResolveBuildImageOutput,
  ResolveSourceArchiveOutput,
  ResolveVerificationTargetOutput,
  SelectBuildArtifactOutput,
  ValidateBuildRecipeOutput,
} from "../../processes/index.ts";
import {
  ARTIFACT_TO_COMPARISON_CONNECTOR_ID,
  buildVerificationArtifactToComparison,
  buildVerificationExecutionToArtifact,
  buildVerificationImageToExecution,
  buildVerificationInputToResolveTarget,
  buildVerificationMetadataToRecipe,
  buildVerificationRecipeToSource,
  buildVerificationSourceToImage,
  buildVerificationTargetToMetadata,
  EXECUTION_TO_ARTIFACT_CONNECTOR_ID,
  IMAGE_TO_EXECUTION_CONNECTOR_ID,
  INPUT_TO_RESOLVE_TARGET_CONNECTOR_ID,
  METADATA_TO_RECIPE_CONNECTOR_ID,
  RECIPE_TO_SOURCE_CONNECTOR_ID,
  SOURCE_TO_IMAGE_CONNECTOR_ID,
  TARGET_TO_METADATA_CONNECTOR_ID,
} from "./connectors.ts";
import { PipelineStepOutputMissingError } from "./error.ts";
import { getRequiredBuildVerificationStepOutput } from "./runtime.ts";
import { pipelineTestDependencies } from "./testing.test.ts";

const runtime = (snapshot: { output?: unknown } | undefined): StepThis =>
  ({
    context: () => ({
      step: {
        get: () => snapshot,
      },
    }),
  }) as unknown as StepThis;

describe("build-verification connectors", () => {
  it("exports the exact stable connector ids", () => {
    assertEquals([
      INPUT_TO_RESOLVE_TARGET_CONNECTOR_ID,
      TARGET_TO_METADATA_CONNECTOR_ID,
      METADATA_TO_RECIPE_CONNECTOR_ID,
      RECIPE_TO_SOURCE_CONNECTOR_ID,
      SOURCE_TO_IMAGE_CONNECTOR_ID,
      IMAGE_TO_EXECUTION_CONNECTOR_ID,
      EXECUTION_TO_ARTIFACT_CONNECTOR_ID,
      ARTIFACT_TO_COMPARISON_CONNECTOR_ID,
    ], [
      "build-verification-input-to-resolve-target",
      "build-verification-target-to-metadata",
      "build-verification-metadata-to-recipe",
      "build-verification-recipe-to-source",
      "build-verification-source-to-image",
      "build-verification-image-to-execution",
      "build-verification-execution-to-artifact",
      "build-verification-artifact-to-comparison",
    ]);
  });

  it("reads a required prior output or throws its unique connector error", () => {
    assertEquals(
      getRequiredBuildVerificationStepOutput<number>(
        runtime({ output: 42 }),
        "step-id",
      ),
      42,
    );
    for (const snapshot of [undefined, {}]) {
      assertThrows(
        () =>
          getRequiredBuildVerificationStepOutput(runtime(snapshot), "step-id"),
        PipelineStepOutputMissingError,
      );
    }
  });

  it("maps public input to target resolution dependencies", async () => {
    const dependencies = pipelineTestDependencies({
      networkEvidence: {
        networkPassphrase: "passphrase",
        allowHttp: false,
        input: "rpc",
      },
    });
    const request = processRequest();
    if (request.mode !== "outOfBand") throw new Error("invalid fixture");
    const result = await buildVerificationInputToResolveTarget(dependencies)
      .run(request);
    assertStrictEquals(result.request, request);
    assertStrictEquals(result.resolver, dependencies.targetResolver);
    assertStrictEquals(result.networkEvidence, dependencies.networkEvidence);
    assertStrictEquals(result.limits, dependencies.limits);
  });

  it("maps every preceding process output from Convee run context", async () => {
    const dependencies = pipelineTestDependencies();
    const context = createRunContext();

    const target = targetProcessState();
    await step((): ResolveVerificationTargetOutput => target, {
      id: RESOLVE_VERIFICATION_TARGET_STEP_ID,
    }).runWith({ context: { parent: context } });
    const metadataInput = await buildVerificationTargetToMetadata(dependencies)
      .runWith({ context: { parent: context } }, target);
    assertStrictEquals(metadataInput.state, target);

    const metadata = metadataProcessState();
    await step((): ParseContractMetadataOutput => metadata, {
      id: PARSE_CONTRACT_METADATA_STEP_ID,
    }).runWith({ context: { parent: context } });
    const recipeInput = await buildVerificationMetadataToRecipe(dependencies)
      .runWith({ context: { parent: context } }, metadata);
    assertStrictEquals(recipeInput.state, metadata);
    assertStrictEquals(recipeInput.commandPolicy, dependencies.commandPolicy);
    assertStrictEquals(recipeInput.optionPolicy, dependencies.optionPolicy);

    const recipe = recipeProcessState();
    await step((): ValidateBuildRecipeOutput => recipe, {
      id: VALIDATE_BUILD_RECIPE_STEP_ID,
    }).runWith({ context: { parent: context } });
    const sourceInput = await buildVerificationRecipeToSource(dependencies)
      .runWith({ context: { parent: context } }, recipe);
    assertStrictEquals(sourceInput.state, recipe);
    assertStrictEquals(sourceInput.provider, dependencies.sourceProvider);

    const source = sourceProcessState();
    await step((): ResolveSourceArchiveOutput => source, {
      id: RESOLVE_SOURCE_ARCHIVE_STEP_ID,
    }).runWith({ context: { parent: context } });
    const imageInput = await buildVerificationSourceToImage(dependencies)
      .runWith({ context: { parent: context } }, source);
    assertStrictEquals(imageInput.state, source);
    assertStrictEquals(imageInput.resolver, dependencies.imageResolver);
    assertStrictEquals(imageInput.policy, dependencies.imagePolicy);

    const image = imageProcessState();
    await step((): ResolveBuildImageOutput => image, {
      id: RESOLVE_BUILD_IMAGE_STEP_ID,
    }).runWith({ context: { parent: context } });
    const executionInput = await buildVerificationImageToExecution(dependencies)
      .runWith({ context: { parent: context } }, image);
    assertStrictEquals(executionInput.state, image);
    assertStrictEquals(executionInput.extractor, dependencies.archiveExtractor);
    assertStrictEquals(executionInput.runner, dependencies.runner);
    assertStrictEquals(
      executionInput.artifactCollector,
      dependencies.artifactCollector,
    );

    const execution = executionProcessState();
    await step((): ExecuteContractBuildOutput => execution, {
      id: EXECUTE_CONTRACT_BUILD_STEP_ID,
    }).runWith({ context: { parent: context } });
    const artifactInput = await buildVerificationExecutionToArtifact(
      dependencies,
    )
      .runWith({ context: { parent: context } }, execution);
    assertStrictEquals(artifactInput.state, execution);

    const artifact = artifactProcessState();
    await step((): SelectBuildArtifactOutput => artifact, {
      id: SELECT_BUILD_ARTIFACT_STEP_ID,
    }).runWith({ context: { parent: context } });
    const comparisonInput = await buildVerificationArtifactToComparison(
      dependencies,
    )
      .runWith({ context: { parent: context } }, artifact);
    assertStrictEquals(comparisonInput.state, artifact);
  });
});
