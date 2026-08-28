import { type Step, step } from "convee";
import { validateBuildRecipe } from "../processes/validate-build-recipe/index.ts";
import { VALIDATE_BUILD_RECIPE_STEP_ID } from "./ids.ts";

/** Creates the validate-build-recipe step used in verifier pipelines. */
export const createValidateBuildRecipeStep = (): Step<
  Parameters<typeof validateBuildRecipe>[0],
  Awaited<ReturnType<typeof validateBuildRecipe>>,
  Error,
  typeof VALIDATE_BUILD_RECIPE_STEP_ID
> => step(validateBuildRecipe, { id: VALIDATE_BUILD_RECIPE_STEP_ID });
