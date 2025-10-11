import { PipelineError } from "../error.ts";

export enum Code {
  UNEXPECTED_ERROR = "PIPE_INVC_000",
  MISSING_ARG = "PIPE_INVC_001",
}

export abstract class InvokeContractError extends PipelineError<Code> {
  override readonly source = "@colibri/core/pipelines/invoke-contract";
}

export class UNEXPECTED_ERROR extends InvokeContractError {
  constructor(cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message:
        "An unexpected error occurred while assembling the 'InvokeContract' pipeline!",
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

export class MISSING_ARG extends InvokeContractError {
  constructor(argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details: `The argument '${argName}' is required but was not provided in the pipeline creation.`,
      cause: undefined,
    });
  }
}

export const ERROR_PIPE_INVC = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
};
