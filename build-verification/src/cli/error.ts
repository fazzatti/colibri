import { BuildVerificationError, Code } from "@/error/base.ts";

/** Raised when CLI flags are missing, conflicting, or malformed. */
export class InvalidCliArgumentsError
  extends BuildVerificationError<Code.INVALID_CLI_ARGUMENTS> {
  /** Creates an invalid CLI-arguments error. */
  constructor(details: string, data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.INVALID_CLI_ARGUMENTS,
      source: "@colibri/build-verification/cli",
      message: "Invalid command-line arguments",
      details,
      data,
    });
  }
}
