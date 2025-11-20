import { PipelineError } from "@/pipelines/error.ts";

export enum Code {
  UNEXPECTED_ERROR = "PIPE_CLTX_000",
  MISSING_ARG = "PIPE_CLTX_001",

  MISSING_RPC_URL = "PIPE_CLTX_002",
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

export class MISSING_RPC_URL extends ClassicTransactionError {
  constructor() {
    super({
      code: Code.MISSING_RPC_URL,
      message: "Missing RPC URL in network configuration",
      details: `The argument 'rpcUrl' is required in the provided 'networkConfig'.`,
      diagnostic: {
        suggestion:
          "Either provide a 'rpc' instance or a valid 'rpcUrl' in the 'networkConfig'.",
        rootCause:
          "The 'rpcUrl' is necessary for the Contract to communicate with the Stellar network. When no 'rpc' instance is provided, the Pipeline needs the 'rpcUrl' to create its own Server instance.",
      },
      cause: undefined,
    });
  }
}

export const ERROR_PIPE_CLTX = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.MISSING_RPC_URL]: MISSING_RPC_URL,
};
