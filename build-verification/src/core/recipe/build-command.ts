import type { ContractBuildRecipe } from "./types.ts";

/** Builds the exact structured Stellar CLI argument vector for one recipe. */
export const createContractBuildArguments = (
  recipe: ContractBuildRecipe,
): readonly string[] =>
  Object.freeze([
    ...recipe.arguments,
    ...recipe.options,
    ...recipe.metadata.flatMap((
      { key, value },
    ) => ["--meta", `${key}=${value}`]),
  ]);
