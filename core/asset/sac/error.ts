import { ColibriError } from "@/error/index.ts";
import type { Asset } from "stellar-sdk";
import type { Diagnostic } from "@/error/types.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type SACErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

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

export enum Code {
  UNEXPECTED_ERROR = "SAC_000",
  MISSING_ARG = "SAC_001",
  FAILED_TO_WRAP_ASSET = "SAC_002",
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

export class MISSING_ARG extends SACError<Code> {
  constructor(argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details: `The argument '${argName}' is required to construct a new Contract instance but was not provided.`,
      data: { argName },
    });
  }
}

export class FAILED_TO_WRAP_ASSET extends SACError<Code> {
  constructor(asset: Asset, cause: Error) {
    super({
      code: Code.FAILED_TO_WRAP_ASSET,
      message: `Failed to wrap asset`,
      details: `An error occurred while attempting to wrap the asset. See the 'cause' for more details.`,
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

export class UNMATCHED_CONTRACT_ID extends SACError<Code> {
  constructor(expected: string, found: string) {
    super({
      code: Code.UNMATCHED_CONTRACT_ID,
      message: `Unmatched contract ID`,
      details: `The contract ID retrieved from the 'deploy' transaction '${found}' does not match the expected contract ID '${expected}'.`,
      data: { expected, found },
    });
  }
}

export class MISSING_RETURN_VALUE extends SACError<Code> {
  constructor(functionName: string) {
    super({
      code: Code.MISSING_RETURN_VALUE,
      message: `Missing return value`,
      details: `The expected return value from the contract method '${functionName}' was not found.`,
      data: {
        functionName,
      },
    });
  }
}

export const ERROR_CONTR = {
  // [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.UNMATCHED_CONTRACT_ID]: UNMATCHED_CONTRACT_ID,
  [Code.FAILED_TO_WRAP_ASSET]: FAILED_TO_WRAP_ASSET,
  [Code.MISSING_RETURN_VALUE]: MISSING_RETURN_VALUE,
};
