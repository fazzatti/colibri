import type { Api } from "stellar-sdk/rpc";
import type {
  ParsedFailedSimulationResponse,
  ParsedSimulationContractError,
  ParsedSimulationContractErrorStackItem,
  ParsedSimulationDiagnosticEvent,
  ParsedSimulationFunctionCall,
} from "@/common/helpers/contract-error-from-failed-simulation-response.ts";
import type { SimulateTransactionInput } from "@/processes/simulate-transaction/types.ts";
import { ProcessError } from "@/processes/error.ts";

/**
 * Stable error codes emitted by the simulate-transaction process.
 */
export enum Code {
  /** An unexpected non-Colibri error escaped simulation handling. */
  UNEXPECTED_ERROR = "SIM_000",
  /** RPC returned a simulation error response without a parsed contract error. */
  SIMULATION_FAILED = "SIM_001",
  /** RPC simulation could not be executed because the RPC call failed. */
  COULD_NOT_SIMULATE_TRANSACTION = "SIM_002",
  /** RPC returned a simulation payload that Colibri could not classify. */
  SIMULATION_RESULT_NOT_VERIFIED = "SIM_003",
  /** RPC returned a simulation error response with a parsed contract error. */
  CONTRACT_ERROR_SIMULATION_FAILED = "SIM_004",
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
 *
 * This is the generic simulation-failure error. When Colibri can identify a
 * surfaced `Error(Contract, #code)`, it throws
 * {@link CONTRACT_ERROR_SIMULATION_FAILED} instead so callers can inspect the
 * parsed contract error and diagnostic stack.
 */
export class SIMULATION_FAILED extends SimulateTransactionError {
  /** Structured metadata carrying the failed simulation response. */
  override readonly meta: {
    data: {
      input: SimulateTransactionInput;
      simulationResponse: Api.SimulateTransactionErrorResponse;
      contractError?: ParsedSimulationContractError;
      rootInvocation?: ParsedSimulationFunctionCall;
      diagnosticEvents: ParsedSimulationDiagnosticEvent[];
      contractErrorStack: ParsedSimulationContractErrorStackItem[];
    };
    cause: null;
  };

  /**
   * Creates a simulation-failed error.
   *
   * @param input - Original process input.
   * @param simulationResponse - Failed RPC simulation response.
   * @param options - Parsed diagnostics and optional overrides used by
   * subclasses.
   */
  constructor(
    input: SimulateTransactionInput,
    simulationResponse: Api.SimulateTransactionErrorResponse,
    options?: {
      code?: Code.SIMULATION_FAILED | Code.CONTRACT_ERROR_SIMULATION_FAILED;
      message?: string;
      details?: string;
      contractError?: ParsedSimulationContractError;
      failedSimulation?: ParsedFailedSimulationResponse;
    },
  ) {
    super({
      code: options?.code ?? Code.SIMULATION_FAILED,
      message: options?.message ?? "Transaction simulation failed!",
      input,
      details: options?.details ??
        "The transaction was simulated but its execution failed. Review simulationResponse for more details and adjust the transaction accordingly.",
    });

    this.meta = {
      data: {
        input,
        simulationResponse,
        ...(options?.failedSimulation?.rootInvocation
          ? { rootInvocation: options.failedSimulation.rootInvocation }
          : {}),
        diagnosticEvents: options?.failedSimulation?.diagnosticEvents ?? [],
        contractErrorStack: options?.failedSimulation?.contractErrorStack ?? [],
        ...(options?.contractError
          ? { contractError: options.contractError }
          : {}),
      },
      cause: null,
    };
  }
}

/**
 * Raised when RPC returns a failed simulation with a contract error code.
 *
 * Use `meta.data.contractError.code` for the surfaced error code and
 * `meta.data.contractErrorStack` to inspect every parsed contract-error event,
 * including which contract emitted it and whether it came from the root or a
 * sub-invocation.
 */
export class CONTRACT_ERROR_SIMULATION_FAILED extends SIMULATION_FAILED {
  /** Structured metadata carrying the failed simulation and contract error. */
  override readonly meta: {
    data: {
      input: SimulateTransactionInput;
      simulationResponse: Api.SimulateTransactionErrorResponse;
      contractError: ParsedSimulationContractError;
      rootInvocation?: ParsedSimulationFunctionCall;
      diagnosticEvents: ParsedSimulationDiagnosticEvent[];
      contractErrorStack: ParsedSimulationContractErrorStackItem[];
    };
    cause: null;
  };

  /**
   * Creates a contract-error simulation failure.
   *
   * @param input - Original process input.
   * @param simulationResponse - Failed RPC simulation response.
   * @param failedSimulation - Parsed failed simulation payload.
   */
  constructor(
    input: SimulateTransactionInput,
    simulationResponse: Api.SimulateTransactionErrorResponse,
    failedSimulation: ParsedFailedSimulationResponse & {
      contractError: ParsedSimulationContractError;
    },
  ) {
    super(input, simulationResponse, {
      code: Code.CONTRACT_ERROR_SIMULATION_FAILED,
      message:
        `Transaction simulation failed with contract error #${failedSimulation.contractError.code}!`,
      details:
        "The transaction simulation failed because the invocation surfaced a contract-defined error. Review meta.data.contractError for the surfaced code and meta.data.contractErrorStack for the ordered diagnostic stack.",
      contractError: failedSimulation.contractError,
      failedSimulation,
    });

    this.meta = {
      data: {
        input,
        simulationResponse,
        contractError: failedSimulation.contractError,
        ...(failedSimulation.rootInvocation
          ? { rootInvocation: failedSimulation.rootInvocation }
          : {}),
        diagnosticEvents: failedSimulation.diagnosticEvents,
        contractErrorStack: failedSimulation.contractErrorStack,
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
    simulationResponse: Api.SimulateTransactionResponse,
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
  [Code.CONTRACT_ERROR_SIMULATION_FAILED]: CONTRACT_ERROR_SIMULATION_FAILED,
};
