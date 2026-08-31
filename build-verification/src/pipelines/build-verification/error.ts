import { BuildVerificationError, Code } from "@/error/base.ts";

/** Raised when required pipeline dependencies are absent. */
export class ProcessDependencyMissingError
  extends BuildVerificationError<Code.PROCESS_DEPENDENCY_MISSING> {
  /** Creates a missing dependency error. */
  constructor(dependency: string) {
    super({
      code: Code.PROCESS_DEPENDENCY_MISSING,
      source: "@colibri/build-verification/pipelines/build-verification",
      message: "Missing build-verification pipeline dependency",
      details: `The required dependency "${dependency}" was not provided.`,
      data: { dependency },
    });
  }
}

/** Raised when pipeline construction fails outside its typed validation. */
export class BuildVerificationPipelineConstructionError
  extends BuildVerificationError<Code.PIPELINE_CONSTRUCTION_FAILED> {
  /** Creates an unexpected pipeline-construction error. */
  constructor(cause: unknown) {
    super({
      code: Code.PIPELINE_CONSTRUCTION_FAILED,
      source: "@colibri/build-verification/pipelines/build-verification",
      message: "Failed to construct build-verification pipeline",
      details:
        "The approved pipeline could not be assembled from its dependencies.",
      cause,
    });
  }
}

/** Raised when a connector cannot read a required preceding step output. */
export class PipelineStepOutputMissingError
  extends BuildVerificationError<Code.PIPELINE_STEP_OUTPUT_MISSING> {
  /** Creates a missing preceding-step-output error. */
  constructor(stepId: string) {
    super({
      code: Code.PIPELINE_STEP_OUTPUT_MISSING,
      source:
        "@colibri/build-verification/pipelines/build-verification/connectors",
      message: "Missing required build-verification step output",
      details:
        `The connector could not read output from the required step "${stepId}".`,
      data: { stepId },
    });
  }
}
