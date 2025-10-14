import type { SendTransactionInput } from "./types.ts";
import { ProcessError } from "../error.ts";

import type { Api } from "stellar-sdk/rpc";
import {
  parseErrorResult,
  parseEvents,
  softTryToXDR,
} from "../../common/helpers/xdr.ts";
import type { xdr } from "stellar-sdk";

export enum Code {
  UNEXPECTED_ERROR = "STX_000",
  MISSING_ARG = "STX_001",
  FAIL_TO_SEND_TRANSACTION = "STX_002",
  TIMEOUT_TOO_LOW = "STX_003",
  WAIT_INTERVAL_TOO_LOW = "STX_004",
  DUPLICATE_TRANSACTION = "STX_005",
  TRY_AGAIN_LATER = "STX_006",
  ERROR_STATUS = "STX_007",
  UNEXPECTED_STATUS = "STX_008",
  FAILED_TO_GET_TRANSACTION_STATUS = "STX_009",
  TRANSACTION_FAILED = "STX_010",
  TRANSACTION_NOT_FOUND = "STX_011",
}

export abstract class SendTransactionError extends ProcessError<
  Code,
  SendTransactionInput
> {
  override readonly source = "@colibri/core/processes/send-transaction";
}

export class UNEXPECTED_ERROR extends SendTransactionError {
  constructor(input: SendTransactionInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred!",
      input,
      details: "See the 'cause' for more details",
      cause,
    });
  }
}

export class MISSING_ARG extends SendTransactionError {
  constructor(input: SendTransactionInput, argName: string) {
    super({
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}!`,
      input,
      details: `The argument '${argName}' is required but was not provided in the input.`,
    });
  }
}

export class FAIL_TO_SEND_TRANSACTION extends SendTransactionError {
  constructor(input: SendTransactionInput, cause: Error) {
    super({
      code: Code.FAIL_TO_SEND_TRANSACTION,
      message: "Failed to send transaction!",
      input,
      details:
        "An error was caught when trying to send the transaction for processing through the RPC. Check the 'cause' section for more details.",
      cause,
    });
  }
}

export class TIMEOUT_TOO_LOW extends SendTransactionError {
  constructor(input: SendTransactionInput, timeoutInSeconds: number) {
    super({
      code: Code.TIMEOUT_TOO_LOW,
      message: "Timeout too low!",
      input,
      details: `The provided timeout (${timeoutInSeconds}s) is too low. It must be at least 1 second.`,
    });
  }
}

export class WAIT_INTERVAL_TOO_LOW extends SendTransactionError {
  constructor(input: SendTransactionInput, waitIntervalInMs: number) {
    super({
      code: Code.WAIT_INTERVAL_TOO_LOW,
      message: "Wait interval too low!",
      input,
      details: `The provided wait interval (${waitIntervalInMs}ms) is too low. It must be at least 100ms.`,
    });
  }
}

export class DUPLICATE_TRANSACTION extends SendTransactionError {
  constructor(input: SendTransactionInput, txHash: string) {
    super({
      code: Code.DUPLICATE_TRANSACTION,
      message: "Duplicate transaction!",
      input,
      details: `The transaction with ID (${txHash}) has already been submitted.`,
      diagnostic: {
        rootCause:
          "The RPC returned the 'DUPLICATE' status when the transaction was sent for processing.",
        suggestion:
          "Check if the transaction has already been submitted or if there are any issues in the implementation causing duplicate submissions.",
      },
    });
  }
}

export class TRY_AGAIN_LATER extends SendTransactionError {
  constructor(input: SendTransactionInput, txHash: string) {
    super({
      code: Code.TRY_AGAIN_LATER,
      message: "Temporary issue, please try again later!",
      input,
      details: `The transaction with ID (${txHash}) could not be processed at this time.`,
      diagnostic: {
        rootCause:
          "The RPC returned a 'TRY_AGAIN_LATER' status when the transaction was sent for processing.",
        suggestion:
          "Wait for a while and try resubmitting the transaction later. There might be an issue with the network or the RPC service.",
      },
    });
  }
}

export class ERROR_STATUS extends SendTransactionError {
  override readonly meta: {
    data: {
      input: SendTransactionInput;
      errorResult: string[] | null;
      diagnosticEvents: ReturnType<typeof parseEvents>;
    };
    cause: null;
  };

  constructor(
    input: SendTransactionInput,
    txHash: string,
    errorResult?: xdr.TransactionResult,
    diagnosticEvents?: xdr.DiagnosticEvent[]
  ) {
    super({
      code: Code.ERROR_STATUS,
      message: "Transaction processing error!",
      input,
      details: `The transaction with ID (${txHash}) encountered an error during processing.`,
      diagnostic: {
        rootCause:
          "The RPC returned an 'ERROR' status when the transaction was sent for processing.",
        suggestion:
          "Investigate the transaction details and the errors under the 'meta' section. Ensure that the transaction is valid and meets all necessary criteria.",
      },
    });

    const parsedErrorResult = parseErrorResult(errorResult);
    const parsedDiagnosticEvents = parseEvents(diagnosticEvents);

    this.meta = {
      data: {
        input,
        errorResult: parsedErrorResult,
        diagnosticEvents: parsedDiagnosticEvents,
      },
      cause: null,
    };
  }
}

export class UNEXPECTED_STATUS extends SendTransactionError {
  constructor(input: SendTransactionInput, txHash: string, status: string) {
    super({
      code: Code.UNEXPECTED_STATUS,
      message: "Unexpected transaction status!",
      input,
      details: `The transaction with ID (${txHash}) returned an unexpected status: ${status}.`,
      diagnostic: {
        rootCause:
          "The RPC returned a status that is not recognized by the current implementation.",
        suggestion:
          "Check for updates to the SDK or RPC documentation to see if there are new statuses that aren't supported and need to be handled.",
      },
    });
  }
}

export class FAILED_TO_GET_TRANSACTION_STATUS extends SendTransactionError {
  constructor(input: SendTransactionInput, txHash: string, error: Error) {
    super({
      code: Code.FAILED_TO_GET_TRANSACTION_STATUS,
      message: "Failed to get transaction status!",
      input,
      details: `The RPC request to get the status for transaction with ID (${txHash}) failed with error: ${error.message}.`,
      diagnostic: {
        rootCause:
          "The RPC request to fetch the transaction status encountered an error.",
        suggestion:
          "Check if the transaction ID is correct and if the transaction has been submitted successfully. Also, verify the network connection and RPC service status.",
      },
      cause: error,
    });
  }
}

export class TRANSACTION_FAILED extends SendTransactionError {
  override readonly meta: {
    data: {
      input: SendTransactionInput;
      transactionXDR: string;
      diagnosticEvents: ReturnType<typeof parseEvents>;

      resultXDR: string;
      resultMetaXDR: string;
    };
    cause: null;
  };

  constructor(
    input: SendTransactionInput,
    txHash: string,
    response: Api.GetFailedTransactionResponse
  ) {
    super({
      code: Code.TRANSACTION_FAILED,
      message: "Transaction failed!",
      input,
      details: `The transaction with ID (${txHash}) failed during processing.`,
      diagnostic: {
        rootCause: "The transaction was processed but resulted in a failure.",
        suggestion:
          "Investigate the transaction details and the errors under the 'meta' section. Ensure that the transaction is valid and meets all necessary criteria.",
      },
    });

    const parsedDiagnosticEvents = parseEvents(response.diagnosticEventsXdr);

    this.meta = {
      data: {
        input,
        diagnosticEvents: parsedDiagnosticEvents,
        transactionXDR: softTryToXDR(() =>
          response.envelopeXdr.toXDR("base64")
        ),
        resultXDR: softTryToXDR(() => response.resultXdr.toXDR("base64")),
        resultMetaXDR: softTryToXDR(() =>
          response.resultMetaXdr.toXDR("base64")
        ),
      },
      cause: null,
    };
  }
}

export class TRANSACTION_NOT_FOUND extends SendTransactionError {
  constructor(input: SendTransactionInput, txHash: string) {
    super({
      code: Code.TRANSACTION_NOT_FOUND,
      message: "Transaction not found!",
      input,
      details: `The transaction with ID (${txHash}) was not found on the network.`,
      diagnostic: {
        rootCause:
          "The transaction does not exist or has not been processed yet.",
        suggestion:
          "Verify that the transaction ID is correct and that the transaction has been submitted. If recently submitted, review the timeout settings and allow some time for processing.",
      },
    });
  }
}

export const ERROR_BY_CODE = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.FAIL_TO_SEND_TRANSACTION]: FAIL_TO_SEND_TRANSACTION,
  [Code.TIMEOUT_TOO_LOW]: TIMEOUT_TOO_LOW,
  [Code.WAIT_INTERVAL_TOO_LOW]: WAIT_INTERVAL_TOO_LOW,
  [Code.DUPLICATE_TRANSACTION]: DUPLICATE_TRANSACTION,
  [Code.TRY_AGAIN_LATER]: TRY_AGAIN_LATER,
  [Code.ERROR_STATUS]: ERROR_STATUS,
  [Code.UNEXPECTED_STATUS]: UNEXPECTED_STATUS,
  [Code.FAILED_TO_GET_TRANSACTION_STATUS]: FAILED_TO_GET_TRANSACTION_STATUS,
  [Code.TRANSACTION_FAILED]: TRANSACTION_FAILED,
};
