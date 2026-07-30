import type { EnforceSimulationInput } from "@/processes/enforce-simulation/types.ts";
import { ProcessError } from "@/processes/error.ts";

/** Stable errors emitted by the enforce-simulation process. */
export enum Code {
  UNEXPECTED_ERROR = "EFS_000",
  MISSING_TRANSACTION = "EFS_001",
  MISSING_RECORDING_SIMULATION = "EFS_002",
  MISSING_RPC = "EFS_003",
}

/** Base class for enforcing-simulation failures. */
export abstract class EnforceSimulationError extends ProcessError<
  Code,
  EnforceSimulationInput
> {
  /** Source identifier for enforcing-simulation failures. */
  override readonly source = "@colibri/core/processes/enforce-simulation";
}

/** Raised when enforcing simulation fails unexpectedly. */
export class UNEXPECTED_ERROR extends EnforceSimulationError {
  /**
   * Creates an unexpected enforcing-simulation error.
   *
   * @param input - Original process input.
   * @param cause - Underlying unexpected error.
   */
  constructor(input: EnforceSimulationInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "Unexpected enforcing-simulation failure!",
      input,
      details: "See the underlying cause for additional details.",
      cause,
    });
  }
}

/** Raised when the transaction is missing from enforcing-simulation input. */
export class MISSING_TRANSACTION extends EnforceSimulationError {
  /**
   * Creates a missing-transaction error.
   *
   * @param input - Original process input.
   */
  constructor(input: EnforceSimulationInput) {
    super({
      code: Code.MISSING_TRANSACTION,
      message: "Missing required argument: transaction",
      input,
      details: "The transaction is required for enforcing simulation.",
    });
  }
}

/** Raised when the recording simulation is missing from process input. */
export class MISSING_RECORDING_SIMULATION extends EnforceSimulationError {
  /**
   * Creates a missing-recording-simulation error.
   *
   * @param input - Original process input.
   */
  constructor(input: EnforceSimulationInput) {
    super({
      code: Code.MISSING_RECORDING_SIMULATION,
      message: "Missing required argument: recordingSimulation",
      input,
      details: "The recording simulation is required for enforcing simulation.",
    });
  }
}

/** Raised when the RPC client is missing from enforcing-simulation input. */
export class MISSING_RPC extends EnforceSimulationError {
  /**
   * Creates a missing-RPC error.
   *
   * @param input - Original process input.
   */
  constructor(input: EnforceSimulationInput) {
    super({
      code: Code.MISSING_RPC,
      message: "Missing required argument: rpc",
      input,
      details: "The RPC client is required for enforcing simulation.",
    });
  }
}

/** Enforcing-simulation error constructors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_TRANSACTION]: MISSING_TRANSACTION,
  [Code.MISSING_RECORDING_SIMULATION]: MISSING_RECORDING_SIMULATION,
  [Code.MISSING_RPC]: MISSING_RPC,
};
