import type { Api } from "stellar-sdk/rpc";
import { ColibriError } from "../../error/index.ts";
import type { Diagnostic } from "../../error/types.ts";
import type { SimulateTransactionInput } from "./types.ts";

export enum Code {
  UNEXPECTED_ERROR = "SIM_000",
  SIMULATION_FAILED = "SIM_001",
  COULD_NOT_SIMULATE_TRANSACTION = "SIM_002",
  SIMULATION_RESULT_NOT_VERIFIED = "SIM_003",
}

export type Meta = {
  cause: Error | null;
  data: {
    input: SimulateTransactionInput;
  };
};

export abstract class SimulateTransactionError extends ColibriError<
  Code,
  Meta
> {
  override readonly meta: Meta;

  constructor(args: {
    code: Code;
    message: string;
    input: SimulateTransactionInput;
    details?: string;
    diagnostic?: Diagnostic;
    cause?: Error;
  }) {
    const meta = {
      cause: args.cause || null,
      data: { input: args.input },
    };

    super({
      domain: "processes" as const,
      source: "@colibri/core/processes/build-transaction",
      code: args.code,
      message: args.message,
      details: args.details || args.message,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}

export class UNEXPECTED_ERROR extends SimulateTransactionError {
  constructor(input: SimulateTransactionInput, cause?: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred!",
      input,
      details: cause ? cause.message : "No additional details",
      cause,
    });
  }
}

export class SIMULATION_FAILED extends SimulateTransactionError {
  override readonly meta: {
    data: {
      input: SimulateTransactionInput;
      simulationResponse: Api.SimulateTransactionErrorResponse;
    };
    cause: null;
  };

  constructor(
    input: SimulateTransactionInput,
    simulationResponse: Api.SimulateTransactionErrorResponse
  ) {
    super({
      code: Code.SIMULATION_FAILED,
      message: "Transaction simulation failed!",
      input,
      details:
        "The transaction was simulated but its execution failed. Review simulationResponse for more details and adjust the transaction accordingly.",
    });

    this.meta = {
      data: {
        input,
        simulationResponse,
      },
      cause: null,
    };
  }
}

export class COULD_NOT_SIMULATE_TRANSACTION extends SimulateTransactionError {
  constructor(input: SimulateTransactionInput, cause?: Error) {
    super({
      code: Code.COULD_NOT_SIMULATE_TRANSACTION,
      message: "The transaction could not be simulated!",
      input,
      details:
        "Something went wrong when trying to simulate the transaction. Review the underlying error under 'cause'.",
      cause,
    });
  }
}

export class SIMULATION_RESULT_NOT_VERIFIED extends SimulateTransactionError {
  override readonly meta: {
    data: {
      input: SimulateTransactionInput;
      simulationResponse: Api.SimulateTransactionResponse;
    };
    cause: null;
  };
  constructor(
    input: SimulateTransactionInput,
    simulationResponse: Api.SimulateTransactionResponse
  ) {
    super({
      code: Code.SIMULATION_RESULT_NOT_VERIFIED,
      message: "The transaction simulation result could not be verified!",
      input,
      details:
        "The transaction was simulated, but the result could not be verified. Review the simulationResponse for more details.",
    });

    this.meta = {
      data: {
        input,
        simulationResponse: simulationResponse,
      },
      cause: null,
    };
  }
}

export const ERROR_SIM = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.SIMULATION_FAILED]: SIMULATION_FAILED,
  [Code.COULD_NOT_SIMULATE_TRANSACTION]: COULD_NOT_SIMULATE_TRANSACTION,
  [Code.SIMULATION_RESULT_NOT_VERIFIED]: SIMULATION_RESULT_NOT_VERIFIED,
};
