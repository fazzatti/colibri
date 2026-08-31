import { accumulateVerificationEvidence } from "@/core/evidence/accumulate.ts";
import { metadataEntriesForEvidence } from "@/core/metadata/parse.ts";
import { parseOutOfBandRecipe, parseSep58Recipe } from "@/core/recipe/index.ts";
import { redactContractBuildVerificationInput } from "@/core/types/input.ts";
import {
  CommandPolicyRejectedError,
  OptionPolicyRejectedError,
} from "@/core/policy/error.ts";
import { MissingOutOfBandRecipeError } from "@/error/core.ts";
import {
  completeNotApplicable,
  contextualizeProcessError,
  recordProcessEvent,
} from "@/processes/shared.ts";
import { ValidateBuildRecipeUnexpectedError } from "@/processes/validate-build-recipe/error.ts";
import type {
  ValidateBuildRecipeInput,
  ValidateBuildRecipeOutput,
} from "@/processes/validate-build-recipe/types.ts";

/** Validates exact recipe fields and command/option policies before I/O. */
export const validateBuildRecipe = async (
  input: ValidateBuildRecipeInput,
): Promise<ValidateBuildRecipeOutput> => {
  if (input.state.state === "complete") return input.state;
  let evidence = input.state.evidence;
  let logs = input.state.logs;
  try {
    const { request, mode, metadata, target } = input.state.value;
    let recipe;
    if (mode === "strictSep58") {
      recipe = parseSep58Recipe(metadata.entries);
      if (!recipe) {
        logs = await recordProcessEvent(input, logs, {
          stage: "validate-build-recipe",
          level: "warning",
          code: "BLDV_SEP58_RECIPE_MISSING",
          message: "Strict metadata did not define a build recipe.",
        });
        return {
          state: "complete",
          result: completeNotApplicable(
            "missingSep58Metadata",
            evidence,
            logs,
            target.wasmHash,
          ),
        };
      }
    } else {
      if (!("recipe" in request) || !request.recipe) {
        throw new MissingOutOfBandRecipeError();
      }
      recipe = parseOutOfBandRecipe(request.recipe);
    }

    const commandDecision = await input.commandPolicy.evaluate(
      recipe.arguments,
    );
    if (!commandDecision.accepted) {
      throw new CommandPolicyRejectedError(
        recipe.arguments,
        commandDecision.reasons,
      );
    }
    const optionDecision = await input.optionPolicy.evaluate(
      recipe.options,
      recipe.arguments,
    );
    if (!optionDecision.accepted) {
      throw new OptionPolicyRejectedError(
        recipe.options,
        optionDecision.reasons,
      );
    }
    const evidenceMetadata = metadataEntriesForEvidence(recipe.metadata);
    const evidenceSourceUri = metadataEntriesForEvidence(
      recipe.sourceUri ? [{ key: "source_uri", value: recipe.sourceUri }] : [],
    )[0]?.value;
    evidence = accumulateVerificationEvidence(evidence, {
      recipeProvenance: mode === "strictSep58"
        ? "onChainSep58Metadata"
        : "callerSupplied",
      recipe: {
        provenance: mode === "strictSep58"
          ? "onChainSep58Metadata"
          : "callerSupplied",
        image: recipe.image,
        arguments: recipe.arguments,
        options: recipe.options,
        metadata: evidenceMetadata,
        sourceUri: evidenceSourceUri,
        sourceSha256: recipe.sourceSha256,
        commandPolicy: commandDecision,
        optionPolicy: optionDecision,
      },
    });
    logs = await recordProcessEvent(input, logs, {
      stage: "validate-build-recipe",
      level: "info",
      code: mode === "strictSep58"
        ? "BLDV_SEP58_RECIPE_VALIDATED"
        : "BLDV_OUT_OF_BAND_RECIPE_VALIDATED",
      message: "Validated exact build recipe and execution argument policies.",
    });
    return {
      state: "active",
      value: { ...input.state.value, recipe },
      evidence,
      logs,
    };
  } catch (error) {
    throw contextualizeProcessError(
      error,
      new ValidateBuildRecipeUnexpectedError(error),
      {
        input: redactContractBuildVerificationInput(input.state.value.request),
        evidence,
        logs,
      },
    );
  }
};

/** Error constructors emitted by {@link validateBuildRecipe}. */
export * from "@/processes/validate-build-recipe/error.ts";
/** Process contracts used by {@link validateBuildRecipe}. */
export * from "@/processes/validate-build-recipe/types.ts";
