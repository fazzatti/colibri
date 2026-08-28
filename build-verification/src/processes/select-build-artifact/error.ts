import { BuildVerificationError, Code } from "../../error/base.ts";

/** Raised when artifact selection fails outside its typed selector contract. */
export class SelectBuildArtifactUnexpectedError
  extends BuildVerificationError<Code.SELECT_ARTIFACT_UNEXPECTED> {
  /** Creates an unexpected artifact-process error. */
  constructor(cause: unknown) {
    super({
      code: Code.SELECT_ARTIFACT_UNEXPECTED,
      source: "@colibri/build-verification/processes/select-build-artifact",
      message: "Unexpected build artifact selection failure",
      details: "The artifact process failed outside a known typed occurrence.",
      cause,
    });
  }
}
