import { BuildVerificationError, Code } from "@/error/base.ts";

/** Raised when recipe validation fails outside typed parser or policy errors. */
export class ValidateBuildRecipeUnexpectedError
  extends BuildVerificationError<Code.VALIDATE_RECIPE_UNEXPECTED> {
  /** Creates an unexpected recipe-process error. */
  constructor(cause: unknown) {
    super({
      code: Code.VALIDATE_RECIPE_UNEXPECTED,
      source: "@colibri/build-verification/processes/validate-build-recipe",
      message: "Unexpected build recipe validation failure",
      details: "The recipe process failed outside a known typed occurrence.",
      cause,
    });
  }
}
