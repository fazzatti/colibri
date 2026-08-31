import { InvalidSep58MetadataError } from "@/error/core.ts";
import type {
  ContractBuildRecipe,
  OutOfBandBuildRecipe,
} from "@/core/recipe/types.ts";

const IMAGE_PATTERN =
  /^(?:localhost(?::\d+)?|[^\s@/]*[.:][^\s@/]*)\/[^\s@]+@sha256:[0-9a-f]{64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** Validates and normalizes an explicitly caller-supplied build recipe. */
export const parseOutOfBandRecipe = (
  recipe: OutOfBandBuildRecipe,
): ContractBuildRecipe => {
  if (!IMAGE_PATTERN.test(recipe.image)) {
    throw new InvalidSep58MetadataError(
      "image",
      recipe.image,
      "The out-of-band image must be a fully qualified sha256 digest reference.",
    );
  }
  const arguments_ = recipe.arguments ?? ["contract", "build"];
  if (
    arguments_.length === 0 || arguments_.some((value) => value.length === 0)
  ) {
    throw new InvalidSep58MetadataError(
      "arguments",
      arguments_,
      "The out-of-band build command must contain non-empty arguments.",
    );
  }
  const options = recipe.options ?? [];
  if (options.some((value) => value.length === 0 || !value.startsWith("--"))) {
    throw new InvalidSep58MetadataError(
      "options",
      options,
      "Each out-of-band build option must be one complete long-form option.",
    );
  }
  if (recipe.sourceSha256 && !SHA256_PATTERN.test(recipe.sourceSha256)) {
    throw new InvalidSep58MetadataError(
      "sourceSha256",
      recipe.sourceSha256,
      "sourceSha256 must be a lowercase 64-character SHA-256 value.",
    );
  }
  return {
    image: recipe.image,
    arguments: [...arguments_],
    options: [...options],
    metadata: [...(recipe.metadata ?? [])],
    sourceSha256: recipe.sourceSha256,
  };
};
