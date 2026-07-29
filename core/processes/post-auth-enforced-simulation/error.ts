import type { PostAuthEnforcedSimulationInput } from "@/processes/post-auth-enforced-simulation/types.ts";
import { ProcessError } from "@/processes/error.ts";

/** Stable errors emitted by the post-auth-enforced-simulation process. */
export enum Code {
  UNEXPECTED_ERROR = "PAE_000",
  MISSING_TRANSACTION = "PAE_001",
  MISSING_RECORDING_SIMULATION = "PAE_002",
  MISSING_RPC = "PAE_003",
}

/** Base class for post-auth enforcing-simulation failures. */
export abstract class PostAuthEnforcedSimulationError extends ProcessError<
  Code,
  PostAuthEnforcedSimulationInput
> {
  /** Source identifier for post-auth enforcing-simulation failures. */
  override readonly source =
    "@colibri/core/processes/post-auth-enforced-simulation";
}

/** Raised when post-auth enforcing simulation fails unexpectedly. */
export class UNEXPECTED_ERROR extends PostAuthEnforcedSimulationError {
  /**
   * Creates an unexpected post-auth simulation error.
   *
   * @param input - Original process input.
   * @param cause - Underlying unexpected error.
   */
  constructor(input: PostAuthEnforcedSimulationInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "Unexpected post-auth enforcing-simulation failure!",
      input,
      details: "See the underlying cause for additional details.",
      cause,
    });
  }
}

/** Raised when the transaction is missing from enforcing-simulation input. */
export class MISSING_TRANSACTION extends PostAuthEnforcedSimulationError {
  /**
   * Creates a missing-transaction error.
   *
   * @param input - Original process input.
   */
  constructor(input: PostAuthEnforcedSimulationInput) {
    super({
      code: Code.MISSING_TRANSACTION,
      message: "Missing required argument: transaction",
      input,
      details:
        "The transaction is required for post-auth enforcing simulation.",
    });
  }
}

/** Raised when the recording simulation is missing from process input. */
export class MISSING_RECORDING_SIMULATION
  extends PostAuthEnforcedSimulationError {
  /**
   * Creates a missing-recording-simulation error.
   *
   * @param input - Original process input.
   */
  constructor(input: PostAuthEnforcedSimulationInput) {
    super({
      code: Code.MISSING_RECORDING_SIMULATION,
      message: "Missing required argument: recordingSimulation",
      input,
      details:
        "The recording simulation is required for post-auth enforcing simulation.",
    });
  }
}

/** Raised when the RPC client is missing from enforcing-simulation input. */
export class MISSING_RPC extends PostAuthEnforcedSimulationError {
  /**
   * Creates a missing-RPC error.
   *
   * @param input - Original process input.
   */
  constructor(input: PostAuthEnforcedSimulationInput) {
    super({
      code: Code.MISSING_RPC,
      message: "Missing required argument: rpc",
      input,
      details: "The RPC client is required for post-auth enforcing simulation.",
    });
  }
}

/** Post-auth enforcing-simulation errors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_TRANSACTION]: MISSING_TRANSACTION,
  [Code.MISSING_RECORDING_SIMULATION]: MISSING_RECORDING_SIMULATION,
  [Code.MISSING_RPC]: MISSING_RPC,
};
