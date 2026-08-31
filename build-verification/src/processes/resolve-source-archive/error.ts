import { BuildVerificationError, Code } from "@/error/base.ts";

/** Raised when source resolution fails outside its typed provider contract. */
export class ResolveSourceArchiveUnexpectedError
  extends BuildVerificationError<Code.RESOLVE_SOURCE_UNEXPECTED> {
  /** Creates an unexpected source-process error. */
  constructor(cause: unknown) {
    super({
      code: Code.RESOLVE_SOURCE_UNEXPECTED,
      source: "@colibri/build-verification/processes/resolve-source-archive",
      message: "Unexpected source archive resolution failure",
      details: "The source process failed outside a known typed occurrence.",
      cause,
    });
  }
}
