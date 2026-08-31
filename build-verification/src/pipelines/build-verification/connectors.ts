import { type Step, step, type StepThis } from "convee";
import type {
  CompareContractWasmInput,
  ExecuteContractBuildInput,
  ParseContractMetadataInput,
  ResolveBuildImageInput,
  ResolveSourceArchiveInput,
  ResolveVerificationTargetInput,
  SelectBuildArtifactInput,
  ValidateBuildRecipeInput,
} from "@/processes/index.ts";
import type {
  ExecuteContractBuildOutput,
  ParseContractMetadataOutput,
  ResolveBuildImageOutput,
  ResolveSourceArchiveOutput,
  ResolveVerificationTargetOutput,
  SelectBuildArtifactOutput,
  ValidateBuildRecipeOutput,
} from "@/processes/index.ts";
import type { BuildVerificationPipelineDependencies } from "@/pipelines/build-verification/types.ts";
import type { ContractBuildVerificationInput } from "@/core/index.ts";
import {
  EXECUTE_CONTRACT_BUILD_STEP_ID,
  PARSE_CONTRACT_METADATA_STEP_ID,
  RESOLVE_BUILD_IMAGE_STEP_ID,
  RESOLVE_SOURCE_ARCHIVE_STEP_ID,
  RESOLVE_VERIFICATION_TARGET_STEP_ID,
  SELECT_BUILD_ARTIFACT_STEP_ID,
  VALIDATE_BUILD_RECIPE_STEP_ID,
} from "@/steps/ids.ts";
import { getRequiredBuildVerificationStepOutput } from "@/pipelines/build-verification/runtime.ts";

/** Stable id of the public-input to target-resolution connector. */
export const INPUT_TO_RESOLVE_TARGET_CONNECTOR_ID =
  "build-verification-input-to-resolve-target" as const;
/** Stable id of the target-resolution to metadata connector. */
export const TARGET_TO_METADATA_CONNECTOR_ID =
  "build-verification-target-to-metadata" as const;
/** Stable id of the metadata to recipe-validation connector. */
export const METADATA_TO_RECIPE_CONNECTOR_ID =
  "build-verification-metadata-to-recipe" as const;
/** Stable id of the recipe-validation to source-resolution connector. */
export const RECIPE_TO_SOURCE_CONNECTOR_ID =
  "build-verification-recipe-to-source" as const;
/** Stable id of the source-resolution to image-resolution connector. */
export const SOURCE_TO_IMAGE_CONNECTOR_ID =
  "build-verification-source-to-image" as const;
/** Stable id of the image-resolution to build-execution connector. */
export const IMAGE_TO_EXECUTION_CONNECTOR_ID =
  "build-verification-image-to-execution" as const;
/** Stable id of the build-execution to artifact-selection connector. */
export const EXECUTION_TO_ARTIFACT_CONNECTOR_ID =
  "build-verification-execution-to-artifact" as const;
/** Stable id of the artifact-selection to comparison connector. */
export const ARTIFACT_TO_COMPARISON_CONNECTOR_ID =
  "build-verification-artifact-to-comparison" as const;

/** Connects the public request to the target-resolution process contract. */
export const buildVerificationInputToResolveTarget = (
  dependencies: BuildVerificationPipelineDependencies,
): Step<
  ContractBuildVerificationInput,
  ResolveVerificationTargetInput,
  Error,
  typeof INPUT_TO_RESOLVE_TARGET_CONNECTOR_ID
> =>
  step<
    [ContractBuildVerificationInput],
    ResolveVerificationTargetInput,
    Error,
    typeof INPUT_TO_RESOLVE_TARGET_CONNECTOR_ID
  >(
    (
      request: ContractBuildVerificationInput,
    ): ResolveVerificationTargetInput => ({
      request,
      resolver: dependencies.targetResolver,
      networkEvidence: dependencies.networkEvidence,
      limits: dependencies.limits,
      logging: dependencies.logging,
      now: dependencies.now,
    }),
    { id: INPUT_TO_RESOLVE_TARGET_CONNECTOR_ID },
  );

/** Connects resolved target state to ordered metadata parsing. */
export const buildVerificationTargetToMetadata = (
  dependencies: BuildVerificationPipelineDependencies,
): Step<
  ResolveVerificationTargetOutput,
  ParseContractMetadataInput,
  Error,
  typeof TARGET_TO_METADATA_CONNECTOR_ID
> =>
  step(function (
    this: StepThis,
    _state: ResolveVerificationTargetOutput,
  ): ParseContractMetadataInput {
    const state = getRequiredBuildVerificationStepOutput<
      ResolveVerificationTargetOutput
    >(this, RESOLVE_VERIFICATION_TARGET_STEP_ID);
    return {
      state,
      limits: dependencies.limits,
      logging: dependencies.logging,
      now: dependencies.now,
    };
  }, { id: TARGET_TO_METADATA_CONNECTOR_ID });

/** Connects parsed metadata state to recipe and policy validation. */
export const buildVerificationMetadataToRecipe = (
  dependencies: BuildVerificationPipelineDependencies,
): Step<
  ParseContractMetadataOutput,
  ValidateBuildRecipeInput,
  Error,
  typeof METADATA_TO_RECIPE_CONNECTOR_ID
> =>
  step(function (
    this: StepThis,
    _state: ParseContractMetadataOutput,
  ): ValidateBuildRecipeInput {
    const state = getRequiredBuildVerificationStepOutput<
      ParseContractMetadataOutput
    >(this, PARSE_CONTRACT_METADATA_STEP_ID);
    return {
      state,
      commandPolicy: dependencies.commandPolicy,
      optionPolicy: dependencies.optionPolicy,
      limits: dependencies.limits,
      logging: dependencies.logging,
      now: dependencies.now,
    };
  }, { id: METADATA_TO_RECIPE_CONNECTOR_ID });

/** Connects validated recipe state to exact source resolution. */
export const buildVerificationRecipeToSource = (
  dependencies: BuildVerificationPipelineDependencies,
): Step<
  ValidateBuildRecipeOutput,
  ResolveSourceArchiveInput,
  Error,
  typeof RECIPE_TO_SOURCE_CONNECTOR_ID
> =>
  step(function (
    this: StepThis,
    _state: ValidateBuildRecipeOutput,
  ): ResolveSourceArchiveInput {
    const state = getRequiredBuildVerificationStepOutput<
      ValidateBuildRecipeOutput
    >(this, VALIDATE_BUILD_RECIPE_STEP_ID);
    return {
      state,
      provider: dependencies.sourceProvider,
      limits: dependencies.limits,
      logging: dependencies.logging,
      now: dependencies.now,
    };
  }, { id: RECIPE_TO_SOURCE_CONNECTOR_ID });

/** Connects resolved source state to OCI image resolution and policy. */
export const buildVerificationSourceToImage = (
  dependencies: BuildVerificationPipelineDependencies,
): Step<
  ResolveSourceArchiveOutput,
  ResolveBuildImageInput,
  Error,
  typeof SOURCE_TO_IMAGE_CONNECTOR_ID
> =>
  step(function (
    this: StepThis,
    _state: ResolveSourceArchiveOutput,
  ): ResolveBuildImageInput {
    const state = getRequiredBuildVerificationStepOutput<
      ResolveSourceArchiveOutput
    >(this, RESOLVE_SOURCE_ARCHIVE_STEP_ID);
    return {
      state,
      resolver: dependencies.imageResolver,
      policy: dependencies.imagePolicy,
      limits: dependencies.limits,
      logging: dependencies.logging,
      now: dependencies.now,
    };
  }, { id: SOURCE_TO_IMAGE_CONNECTOR_ID });

/** Connects policy-approved image state to isolated build execution. */
export const buildVerificationImageToExecution = (
  dependencies: BuildVerificationPipelineDependencies,
): Step<
  ResolveBuildImageOutput,
  ExecuteContractBuildInput,
  Error,
  typeof IMAGE_TO_EXECUTION_CONNECTOR_ID
> =>
  step(function (
    this: StepThis,
    _state: ResolveBuildImageOutput,
  ): ExecuteContractBuildInput {
    const state = getRequiredBuildVerificationStepOutput<
      ResolveBuildImageOutput
    >(
      this,
      RESOLVE_BUILD_IMAGE_STEP_ID,
    );
    return {
      state,
      extractor: dependencies.archiveExtractor,
      runner: dependencies.runner,
      artifactCollector: dependencies.artifactCollector,
      allowBuildNetwork: dependencies.allowBuildNetwork,
      limits: dependencies.limits,
      logging: dependencies.logging,
      workspace: dependencies.workspace,
      now: dependencies.now,
    };
  }, { id: IMAGE_TO_EXECUTION_CONNECTOR_ID });

/** Connects captured candidates to deterministic artifact selection. */
export const buildVerificationExecutionToArtifact = (
  dependencies: BuildVerificationPipelineDependencies,
): Step<
  ExecuteContractBuildOutput,
  SelectBuildArtifactInput,
  Error,
  typeof EXECUTION_TO_ARTIFACT_CONNECTOR_ID
> =>
  step(function (
    this: StepThis,
    _state: ExecuteContractBuildOutput,
  ): SelectBuildArtifactInput {
    const state = getRequiredBuildVerificationStepOutput<
      ExecuteContractBuildOutput
    >(this, EXECUTE_CONTRACT_BUILD_STEP_ID);
    return {
      state,
      limits: dependencies.limits,
      logging: dependencies.logging,
      now: dependencies.now,
    };
  }, { id: EXECUTION_TO_ARTIFACT_CONNECTOR_ID });

/** Connects the selected artifact to exact raw Wasm comparison. */
export const buildVerificationArtifactToComparison = (
  dependencies: BuildVerificationPipelineDependencies,
): Step<
  SelectBuildArtifactOutput,
  CompareContractWasmInput,
  Error,
  typeof ARTIFACT_TO_COMPARISON_CONNECTOR_ID
> =>
  step(function (
    this: StepThis,
    _state: SelectBuildArtifactOutput,
  ): CompareContractWasmInput {
    const state = getRequiredBuildVerificationStepOutput<
      SelectBuildArtifactOutput
    >(this, SELECT_BUILD_ARTIFACT_STEP_ID);
    return {
      state,
      limits: dependencies.limits,
      logging: dependencies.logging,
      now: dependencies.now,
    };
  }, { id: ARTIFACT_TO_COMPARISON_CONNECTOR_ID });
