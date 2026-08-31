import { BuildVerificationError, Code } from "@/error/base.ts";

/** Raised when target resolution fails outside its typed provider contract. */
export class ResolveVerificationTargetUnexpectedError
  extends BuildVerificationError<Code.RESOLVE_TARGET_UNEXPECTED> {
  /** Creates an unexpected target-process error. */
  constructor(cause: unknown) {
    super({
      code: Code.RESOLVE_TARGET_UNEXPECTED,
      source:
        "@colibri/build-verification/processes/resolve-verification-target",
      message: "Unexpected verification-target resolution failure",
      details: "The target process failed outside a known typed occurrence.",
      cause,
    });
  }
}
