import { ColibriError } from "@/error/index.ts";
import type { Asset } from "stellar-sdk";
import type { Diagnostic } from "@/error/types.ts";

/**
 * Shared metadata shape used by SAC errors.
 */
export type Meta = {
  cause: Error | null;
  data: unknown;
};

/**
 * Constructor payload used by concrete SAC error classes.
 */
export type SACErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

/**
 * Base class for all Stellar Asset Contract errors.
 */
export abstract class SACError<Code extends string> extends ColibriError<
  Code,
  Meta
> {
  override readonly meta: Meta;

  constructor(args: SACErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "contract" as const,
      source: "@colibri/contract/SAC",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}

/**
 * Stable SAC error codes.
 */
export enum Code {
  UNEXPECTED_ERROR = "SAC_000",
  MISSING_ARG = "SAC_001",
  FAILED_TO_DEPLOY_CONTRACT = "SAC_002",
  UNMATCHED_CONTRACT_ID = "SAC_003",
  MISSING_RETURN_VALUE = "SAC_004",
}

// Currently unused, reserving
//
// export class UNEXPECTED_ERROR extends SACError<Code> {
//   constructor(cause: Error) {
//     super({
//       code: Code.UNEXPECTED_ERROR,
//       message: "An unexpected error occurred in the Contract module!",
//       details: "See the 'cause' for more details",
//       cause,
//       data: {},
//     });
//   }
// }

/**
 * Raised when a required SAC argument is missing.
 */
export class MISSING_ARG extends SACError<Code> {
  constructor(argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details:
        `The argument '${argName}' is required to construct a new Contract instance but was not provided.`,
      data: { argName },
    });
  }
}

/**
 * Raised when the SAC deployment for a classic asset fails.
 */
export class FAILED_TO_DEPLOY_CONTRACT extends SACError<Code> {
  constructor(asset: Asset, cause: Error) {
    super({
      code: Code.FAILED_TO_DEPLOY_CONTRACT,
      message: `Failed to deploy Stellar Asset Contract`,
      details:
        `An error occurred while attempting to deploy the Stellar Asset Contract for the provided asset. See the 'cause' for more details.`,
      cause,
      data: {
        asset: {
          code: asset.code,
          issuer: asset.issuer,
        },
      },
    });
  }
}

/**
 * Raised when a deployment response resolves to an unexpected contract id.
 */
export class UNMATCHED_CONTRACT_ID extends SACError<Code> {
  constructor(expected: string, found: string) {
    super({
      code: Code.UNMATCHED_CONTRACT_ID,
      message: `Unmatched contract ID`,
      details:
        `The contract ID retrieved from the 'deploy' transaction '${found}' does not match the expected contract ID '${expected}'.`,
      data: { expected, found },
    });
  }
}

/**
 * Raised when a SAC read path returns no value where one was expected.
 */
export class MISSING_RETURN_VALUE extends SACError<Code> {
  constructor(functionName: string) {
    super({
      code: Code.MISSING_RETURN_VALUE,
      message: `Missing return value`,
      details:
        `The expected return value from the contract method '${functionName}' was not found.`,
      data: {
        functionName,
      },
    });
  }
}

/**
 * Error code to constructor map for SAC errors.
 */
export const ERROR_CONTR = {
  // [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.UNMATCHED_CONTRACT_ID]: UNMATCHED_CONTRACT_ID,
  [Code.FAILED_TO_DEPLOY_CONTRACT]: FAILED_TO_DEPLOY_CONTRACT,
  [Code.MISSING_RETURN_VALUE]: MISSING_RETURN_VALUE,
};
