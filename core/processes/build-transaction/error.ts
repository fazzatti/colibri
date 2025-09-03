import type { BuildTransactionInput } from "./types.ts";
import { ProcessError } from "../error.ts";

export enum Code {
  UNEXPECTED_ERROR = "BTX_000",
  INVALID_BASE_FEE = "BTX_001",
  BASE_FEE_TOO_LOW = "BTX_002",
  COULD_NOT_LOAD_SOURCE_ACCOUNT = "BTX_003",
  COULD_NOT_CREATE_TRANSACTION_BUILDER = "BTX_004",
  COULD_NOT_SET_SOROBAN_DATA = "BTX_005",
  COULD_NOT_BUILD_TRANSACTION = "BTX_006",
  COULD_NOT_INITIALIZE_ACCOUNT_WITH_SEQUENCE = "BTX_007",
  CONFLICTING_TIME_CONSTRAINTS = "BTX_008",
  FAILED_TO_SET_PRECONDITIONS = "BTX_009",
  NO_OPERATIONS_PROVIDED = "BTX_010",
  RPC_REQUIRED_TO_LOAD_ACCOUNT = "BTX_011",
}

export abstract class BuildTransactionError extends ProcessError<
  Code,
  BuildTransactionInput
> {
  override readonly source = "@colibri/core/processes/build-transaction";
}

export class UNEXPECTED_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred!",
      input,
      details: cause.message,
      cause,
    });
  }
}

export class INVALID_BASE_FEE_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput) {
    super({
      code: Code.INVALID_BASE_FEE,
      message: "Invalid Base Fee!",
      input,
      details: `The provided base fee '${input.baseFee}' couldn't be parsed.`,
      diagnostic: {
        rootCause:
          "The base fee provided could not be converted to a valid number.",
        suggestion:
          "Provide a valid base fee as a number string (e.g., '100', '1000').",
        materials: [
          "https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering",
        ],
      },
    });
  }
}

export class BASE_FEE_TOO_LOW_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput) {
    super({
      code: Code.BASE_FEE_TOO_LOW,
      message: "Base fee is too low!",
      input,
      details: `The provided base fee '${input.baseFee}' is not valid. Must be greater than 0.`,
      diagnostic: {
        rootCause: "The base fee provided is less than or equal to 0.",
        suggestion:
          "Provide a valid base fee greater than 0. Ideally over 100 stroops as the network base fee is set to 100.",
        materials: [
          "https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering",
        ],
      },
    });
  }
}

export class COULD_NOT_LOAD_ACCOUNT_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput, cause: Error) {
    super({
      code: Code.COULD_NOT_LOAD_SOURCE_ACCOUNT,
      message: "Could not load source account!",
      input,
      details: `The source account '${input.source}' could not be loaded.`,
      diagnostic: {
        rootCause:
          "The account could not be found or accessed when using the rpc function 'getAccount'. This indicates it was not created or have been merged(deleted).",
        suggestion:
          "Ensure the account exists and is accessible. For test networks you can use the friendbot to create accounts. For further details, check the underlying error under meta-> cause",
        materials: [
          "https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts",
        ],
      },
      cause,
    });
  }
}

export class COULD_NOT_CREATE_TRANSACTION_BUILDER_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput, cause: Error) {
    super({
      code: Code.COULD_NOT_CREATE_TRANSACTION_BUILDER,
      message: "Could not create transaction builder!",
      input,
      details: "The transaction builder could not be created.",
      cause,
    });
  }
}

export class COULD_NOT_SET_SOROBAN_DATA_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput, cause: Error) {
    super({
      code: Code.COULD_NOT_SET_SOROBAN_DATA,
      message: "Could not set Soroban data!",
      input,
      details: "The Soroban data could not be set.",
      cause,
    });
  }
}

export class COULD_NOT_BUILD_TRANSACTION_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput, cause: Error) {
    super({
      code: Code.COULD_NOT_BUILD_TRANSACTION,
      message: "Could not build transaction!",
      input,
      details:
        "The transaction could not be built. This indicates that some inner parameters of the transaction could be invalid.",
      cause,
    });
  }
}

export class COULD_NOT_INITIALIZE_ACCOUNT_WITH_SEQUENCE_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput, cause: Error) {
    super({
      code: Code.COULD_NOT_INITIALIZE_ACCOUNT_WITH_SEQUENCE,
      message: "Could not initialize account with provided sequence!",
      input,
      details: `The account object for '${input.source}' could not be initialized with the provided sequence '${input.sequence}'`,
      diagnostic: {
        rootCause:
          "The sequence number provided could not be parsed into a valid number by the underlying Stellar SDK.",
        suggestion:
          "Ensure the sequence number is a valid bigint string (e.g., '12345678901234567890').",
      },
      cause,
    });
  }
}

export class CONFLICTING_TIME_CONSTRAINTS_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput) {
    super({
      code: Code.CONFLICTING_TIME_CONSTRAINTS,
      message: "Conflicting time constraints!",
      input,
      details:
        "Both timeBounds and timeoutSeconds are set in preconditions, which is not allowed.",
      diagnostic: {
        rootCause:
          "The preconditions provided include both timeBounds and timeoutSeconds. These two settings conflict with each other as they both define time constraints for the transaction.",
        suggestion:
          "Set only one of timeBounds or timeoutSeconds in the preconditions to avoid conflicts.",
      },
    });
  }
}

export class FAILED_TO_SET_PRECONDITIONS_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput, cause: Error) {
    super({
      code: Code.FAILED_TO_SET_PRECONDITIONS,
      message: "Failed to set preconditions!",
      input,
      details:
        "The preconditions defined for this transaction could not be set.",
      diagnostic: {
        rootCause:
          "While attempting to add the preconditions to the transaction builder, an errors was issued by the underlying Stellar SDK.",
        suggestion: "Check the source error under meta->cause.",
      },
      cause,
    });
  }
}

export class NO_OPERATIONS_PROVIDED_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput) {
    super({
      code: Code.NO_OPERATIONS_PROVIDED,
      message: "No operations provided!",
      input,
      details:
        "The input does not contain any operations to add to the transaction.",
      diagnostic: {
        rootCause: "The operations array in the input is empty or undefined.",
        suggestion:
          "Provide at least one operation in the operations array to build a valid transaction.",
      },
    });
  }
}

export class RPC_REQUIRED_TO_LOAD_ACCOUNT_ERROR extends BuildTransactionError {
  constructor(input: BuildTransactionInput) {
    super({
      code: Code.RPC_REQUIRED_TO_LOAD_ACCOUNT,
      message: "RPC is required to load account!",
      input,
      details:
        "The input does not contain a valid RPC object to load the account.",
      diagnostic: {
        rootCause:
          "The RPC object is missing or invalid. This is required when the sequence number is not provided. ",
        suggestion:
          "Provide a valid RPC object in the input to load the account or the sequence number for the source account.",
      },
    });
  }
}

export const ERROR_BTX = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.INVALID_BASE_FEE]: INVALID_BASE_FEE_ERROR,
  [Code.BASE_FEE_TOO_LOW]: BASE_FEE_TOO_LOW_ERROR,
  [Code.COULD_NOT_LOAD_SOURCE_ACCOUNT]: COULD_NOT_LOAD_ACCOUNT_ERROR,
  [Code.COULD_NOT_CREATE_TRANSACTION_BUILDER]:
    COULD_NOT_CREATE_TRANSACTION_BUILDER_ERROR,
  [Code.COULD_NOT_SET_SOROBAN_DATA]: COULD_NOT_SET_SOROBAN_DATA_ERROR,
  [Code.COULD_NOT_BUILD_TRANSACTION]: COULD_NOT_BUILD_TRANSACTION_ERROR,
  [Code.COULD_NOT_INITIALIZE_ACCOUNT_WITH_SEQUENCE]:
    COULD_NOT_INITIALIZE_ACCOUNT_WITH_SEQUENCE_ERROR,
  [Code.CONFLICTING_TIME_CONSTRAINTS]: CONFLICTING_TIME_CONSTRAINTS_ERROR,
  [Code.FAILED_TO_SET_PRECONDITIONS]: FAILED_TO_SET_PRECONDITIONS_ERROR,
  [Code.NO_OPERATIONS_PROVIDED]: NO_OPERATIONS_PROVIDED_ERROR,
  [Code.RPC_REQUIRED_TO_LOAD_ACCOUNT]: RPC_REQUIRED_TO_LOAD_ACCOUNT_ERROR,
};
