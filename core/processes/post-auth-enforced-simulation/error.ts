import type { PostAuthEnforcedSimulationInput } from "@/processes/post-auth-enforced-simulation/types.ts";
import { ProcessError } from "@/processes/error.ts";

/** Stable errors emitted by the post-auth-enforced-simulation process. */
export enum Code {
  UNEXPECTED_ERROR = "PAE_000",
  MISSING_ARG = "PAE_001",
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

/** Raised when a required post-auth simulation field is missing. */
export class MISSING_ARG extends PostAuthEnforcedSimulationError {
  /**
   * Creates a missing-argument error.
   *
   * @param input - Original process input.
   * @param argName - Missing argument name.
   */
  constructor(input: PostAuthEnforcedSimulationInput, argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      input,
      details:
        `The argument '${argName}' is required for post-auth enforcing simulation.`,
    });
  }
}

/** Post-auth enforcing-simulation errors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
};
