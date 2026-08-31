import { ColibriError } from "@colibri/core";
import { type Pipe, pipe, type PipeContext } from "convee";
import {
  createCompareContractWasmStep,
  createExecuteContractBuildStep,
  createParseContractMetadataStep,
  createResolveBuildImageStep,
  createResolveSourceArchiveStep,
  createResolveVerificationTargetStep,
  createSelectBuildArtifactStep,
  createValidateBuildRecipeStep,
} from "@/steps/index.ts";
import {
  buildVerificationArtifactToComparison,
  buildVerificationExecutionToArtifact,
  buildVerificationImageToExecution,
  buildVerificationInputToResolveTarget,
  buildVerificationMetadataToRecipe,
  buildVerificationRecipeToSource,
  buildVerificationSourceToImage,
  buildVerificationTargetToMetadata,
} from "@/pipelines/build-verification/connectors.ts";
import {
  BuildVerificationPipelineConstructionError,
  ProcessDependencyMissingError,
} from "@/pipelines/build-verification/error.ts";
import type { CreateBuildVerificationPipelineArgs } from "@/pipelines/build-verification/types.ts";

/** Stable id of the contract build-verification pipeline. */
export const BUILD_VERIFICATION_PIPELINE_ID =
  "BuildVerificationPipeline" as const;

const REQUIRED_DEPENDENCIES = [
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
] as const satisfies readonly (keyof CreateBuildVerificationPipelineArgs)[];

type BuildVerificationPipelineSteps = readonly [
  ReturnType<typeof buildVerificationInputToResolveTarget>,
  ReturnType<typeof createResolveVerificationTargetStep>,
  ReturnType<typeof buildVerificationTargetToMetadata>,
  ReturnType<typeof createParseContractMetadataStep>,
  ReturnType<typeof buildVerificationMetadataToRecipe>,
  ReturnType<typeof createValidateBuildRecipeStep>,
  ReturnType<typeof buildVerificationRecipeToSource>,
  ReturnType<typeof createResolveSourceArchiveStep>,
  ReturnType<typeof buildVerificationSourceToImage>,
  ReturnType<typeof createResolveBuildImageStep>,
  ReturnType<typeof buildVerificationImageToExecution>,
  ReturnType<typeof createExecuteContractBuildStep>,
  ReturnType<typeof buildVerificationExecutionToArtifact>,
  ReturnType<typeof createSelectBuildArtifactStep>,
  ReturnType<typeof buildVerificationArtifactToComparison>,
  ReturnType<typeof createCompareContractWasmStep>,
];

type BuildVerificationPipelineRuntime = Pipe<
  BuildVerificationPipelineSteps,
  Error,
  PipeContext<BuildVerificationPipelineSteps>,
  typeof BUILD_VERIFICATION_PIPELINE_ID
>;

const buildBuildVerificationPipeline = (
  dependencies: CreateBuildVerificationPipelineArgs,
): BuildVerificationPipelineRuntime => {
  const pipelineSteps: BuildVerificationPipelineSteps = [
    buildVerificationInputToResolveTarget(dependencies),
    createResolveVerificationTargetStep(),
    buildVerificationTargetToMetadata(dependencies),
    createParseContractMetadataStep(),
    buildVerificationMetadataToRecipe(dependencies),
    createValidateBuildRecipeStep(),
    buildVerificationRecipeToSource(dependencies),
    createResolveSourceArchiveStep(),
    buildVerificationSourceToImage(dependencies),
    createResolveBuildImageStep(),
    buildVerificationImageToExecution(dependencies),
    createExecuteContractBuildStep(),
    buildVerificationExecutionToArtifact(dependencies),
    createSelectBuildArtifactStep(),
    buildVerificationArtifactToComparison(dependencies),
    createCompareContractWasmStep(),
  ] as const;

  return pipe([...pipelineSteps], { id: BUILD_VERIFICATION_PIPELINE_ID });
};

/** Creates the composable build-verification pipeline. */
export const createBuildVerificationPipeline = (
  dependencies: CreateBuildVerificationPipelineArgs,
): ReturnType<typeof buildBuildVerificationPipeline> => {
  try {
    for (const name of REQUIRED_DEPENDENCIES) {
      if (dependencies?.[name] === undefined) {
        throw new ProcessDependencyMissingError(name);
      }
    }
    return buildBuildVerificationPipeline(dependencies);
  } catch (error) {
    if (ColibriError.is(error)) throw error;
    throw new BuildVerificationPipelineConstructionError(error);
  }
};

/** Runtime type returned by {@link createBuildVerificationPipeline}. */
export type BuildVerificationPipeline = ReturnType<
  typeof createBuildVerificationPipeline
>;

/** Plugin accepted by a build-verification pipeline process or connector. */
export type BuildVerificationPipelinePlugin = Parameters<
  BuildVerificationPipeline["use"]
>[0];

/** Stable connector ids and connector factories. */
export * from "@/pipelines/build-verification/connectors.ts";
/** Pipeline-owned error constructors. */
export * from "@/pipelines/build-verification/error.ts";
/** Connector runtime helpers. */
export * from "@/pipelines/build-verification/runtime.ts";
/** Pipeline construction contracts. */
export * from "@/pipelines/build-verification/types.ts";
