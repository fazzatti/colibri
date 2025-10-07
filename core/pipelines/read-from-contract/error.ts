import { PipelineError } from "../error.ts";

export enum Code {
  UNEXPECTED_ERROR = "PIPE_RFC_000",
  MISSING_ARG = "PIPE_RFC_001",
}

export abstract class ReadFromContractError extends PipelineError<Code> {
  override readonly source = "@colibri/core/pipelines/read-from-contract";
}

export class UNEXPECTED_ERROR extends ReadFromContractError {
  constructor(cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message:
        "An unexpected error occurred while assembling the 'ReadFromContract' pipeline!",
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

export class MISSING_ARG extends ReadFromContractError {
  constructor(argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details: `The argument '${argName}' is required but was not provided in the input.`,
      cause: undefined,
    });
  }
}

export const ERROR_PIPE_RFC = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
};
