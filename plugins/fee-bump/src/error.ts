import { PluginError } from "@colibri/core";

type Data = undefined | unknown;

export enum Code {
  UNEXPECTED_ERROR = "PLG_FBP_000",
  MISSING_ARG = "PLG_FBP_001",
  NOT_A_TRANSACTION = "PLG_FBP_002",
}

export abstract class FeeBumpPluginError extends PluginError<Code, Data> {
  override readonly source = "@colibri/core/plugins/fee-bump";
}

export class UNEXPECTED_ERROR extends FeeBumpPluginError {
  constructor(cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message:
        "An unexpected error occurred while assembling the 'FeeBumpPlugin' pipeline!",
      details: "See the 'cause' for more details",
      cause,
      data: {},
    });
  }
}

export class MISSING_ARG extends FeeBumpPluginError {
  constructor(argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details: `The argument '${argName}' is required but was not provided in the pipeline creation.`,
      data: {},
    });
  }
}

export class NOT_A_TRANSACTION extends FeeBumpPluginError {
  override readonly meta: {
    data: {
      transaction: unknown;
    };
    cause: null;
  };
  constructor(transaction: unknown) {
    super({
      code: Code.NOT_A_TRANSACTION,
      message: `The provided transaction is not a valid Transaction object.`,
      details: `The argument 'transaction' is expected to be a valid Stellar Transaction object to be wrapped in a FeeBumpTransaction.`,
      data: {},
    });

    this.meta = { data: { transaction }, cause: null };
  }
}

export const ERROR_PLG_FBP = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.NOT_A_TRANSACTION]: NOT_A_TRANSACTION,
};
