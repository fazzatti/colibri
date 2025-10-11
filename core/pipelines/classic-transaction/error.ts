import { PipelineError } from "../error.ts";

export enum Code {
  UNEXPECTED_ERROR = "PIPE_CLTX_000",
  MISSING_ARG = "PIPE_CLTX_001",
}

export abstract class ClassicTransactionError extends PipelineError<Code> {
  override readonly source = "@colibri/core/pipelines/classic-transaction";
}

export class UNEXPECTED_ERROR extends ClassicTransactionError {
  constructor(cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message:
        "An unexpected error occurred while assembling the 'ClassicTransaction' pipeline!",
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

export class MISSING_ARG extends ClassicTransactionError {
  constructor(argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details: `The argument '${argName}' is required but was not provided in the pipeline creation.`,
      cause: undefined,
    });
  }
}

export const ERROR_PIPE_CLTX = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
};
