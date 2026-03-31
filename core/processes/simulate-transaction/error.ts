import type { Api } from "stellar-sdk/rpc";
import type { SimulateTransactionInput } from "@/processes/simulate-transaction/types.ts";
import { ProcessError } from "@/processes/error.ts";

/**
 * Stable error codes emitted by the simulate-transaction process.
 */
export enum Code {
  UNEXPECTED_ERROR = "SIM_000",
  SIMULATION_FAILED = "SIM_001",
  COULD_NOT_SIMULATE_TRANSACTION = "SIM_002",
  SIMULATION_RESULT_NOT_VERIFIED = "SIM_003",
}

/**
 * Base class for simulate-transaction process errors.
 */
export abstract class SimulateTransactionError extends ProcessError<
  Code,
  SimulateTransactionInput
> {
  /** Source identifier for simulate-transaction process failures. */
  override readonly source = "@colibri/core/processes/simulate-transaction";
}

/**
 * Raised when simulation fails unexpectedly.
 */
export class UNEXPECTED_ERROR extends SimulateTransactionError {
  /**
   * Creates an unexpected simulation error.
   *
   * @param input - Original process input.
   * @param cause - Underlying unexpected error.
   */
  constructor(input: SimulateTransactionInput, cause?: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred!",
      input,
      details: "See the 'cause' for additional details",
      cause,
    });
  }
}

/**
 * Raised when RPC returns a failed simulation result.
 */
export class SIMULATION_FAILED extends SimulateTransactionError {
  /** Structured metadata carrying the failed simulation response. */
  override readonly meta: {
    data: {
      input: SimulateTransactionInput;
      simulationResponse: Api.SimulateTransactionErrorResponse;
    };
    cause: null;
  };

  /**
   * Creates a simulation-failed error.
   *
   * @param input - Original process input.
   * @param simulationResponse - Failed RPC simulation response.
   */
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

/**
 * Raised when the transaction could not be simulated at all.
 */
export class COULD_NOT_SIMULATE_TRANSACTION extends SimulateTransactionError {
  /**
   * Creates a simulation transport/runtime error.
   *
   * @param input - Original process input.
   * @param cause - Underlying simulation error.
   */
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

/**
 * Raised when a simulation result cannot be verified.
 */
export class SIMULATION_RESULT_NOT_VERIFIED extends SimulateTransactionError {
  /** Structured metadata carrying the unverifiable simulation response. */
  override readonly meta: {
    data: {
      input: SimulateTransactionInput;
      simulationResponse: Api.SimulateTransactionResponse;
    };
    cause: null;
  };

  /**
   * Creates a simulation-verification error.
   *
   * @param input - Original process input.
   * @param simulationResponse - Simulation response that could not be verified.
   */
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

/**
 * Simulate-transaction error constructors indexed by stable code.
 */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.SIMULATION_FAILED]: SIMULATION_FAILED,
  [Code.COULD_NOT_SIMULATE_TRANSACTION]: COULD_NOT_SIMULATE_TRANSACTION,
  [Code.SIMULATION_RESULT_NOT_VERIFIED]: SIMULATION_RESULT_NOT_VERIFIED,
};
