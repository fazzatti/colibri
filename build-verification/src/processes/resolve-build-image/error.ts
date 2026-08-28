import { BuildVerificationError, Code } from "../../error/base.ts";

/** Raised when image resolution fails outside typed resolver or policy errors. */
export class ResolveBuildImageUnexpectedError
  extends BuildVerificationError<Code.RESOLVE_IMAGE_UNEXPECTED> {
  /** Creates an unexpected image-process error. */
  constructor(cause: unknown) {
    super({
      code: Code.RESOLVE_IMAGE_UNEXPECTED,
      source: "@colibri/build-verification/processes/resolve-build-image",
      message: "Unexpected build image resolution failure",
      details: "The image process failed outside a known typed occurrence.",
      cause,
    });
  }
}
