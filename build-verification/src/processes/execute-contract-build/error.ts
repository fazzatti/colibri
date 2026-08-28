import { BuildVerificationError, Code } from "../../error/base.ts";

/** Raised when the disposable verification workspace cannot be created. */
export class WorkspaceInitializationFailedError
  extends BuildVerificationError<Code.WORKSPACE_INITIALIZATION_FAILED> {
  /** Creates a workspace initialization error. */
  constructor(cause: unknown) {
    super({
      code: Code.WORKSPACE_INITIALIZATION_FAILED,
      source: "@colibri/build-verification/processes/execute-contract-build",
      message: "Failed to initialize build workspace",
      details: "A disposable source and output workspace could not be created.",
      cause,
    });
  }
}

/** Raised when an owned build workspace cannot be removed. */
export class WorkspaceCleanupFailedError
  extends BuildVerificationError<Code.WORKSPACE_CLEANUP_FAILED> {
  /** Creates a workspace cleanup error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.WORKSPACE_CLEANUP_FAILED,
      source: "@colibri/build-verification/processes/execute-contract-build",
      message: "Failed to clean build workspace",
      details: "The disposable verification workspace could not be removed.",
      data: { path },
      cause,
    });
  }
}

/** Raised when build execution fails outside typed boundary errors. */
export class ExecuteContractBuildUnexpectedError
  extends BuildVerificationError<Code.EXECUTE_BUILD_UNEXPECTED> {
  /** Creates an unexpected execution-process error. */
  constructor(cause: unknown) {
    super({
      code: Code.EXECUTE_BUILD_UNEXPECTED,
      source: "@colibri/build-verification/processes/execute-contract-build",
      message: "Unexpected contract build execution failure",
      details: "The execution process failed outside a known typed occurrence.",
      cause,
    });
  }
}
