import { Api, type Server } from "stellar-sdk/rpc";
import {
  DEFAULT_OPTIONS,
  type SendTransactionInput,
  type SendTransactionOutput,
  SendTransactionStatus,
} from "@/processes/send-transaction/types.ts";
import * as ERROR from "@/processes/send-transaction/error.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { assert } from "@/common/assert/assert.ts";
import { getTransactionTimeout } from "@/common/helpers/transaction.ts";
import { ResultOrError } from "@/common/deferred/result-or-error.ts";

/** Submits a signed transaction to Stellar RPC and waits for a terminal result. */
export const sendTransaction = async (
  input: SendTransactionInput,
): Promise<SendTransactionOutput> => {
  try {
    const { transaction, rpc, options } = input;
    const {
      timeoutInSeconds,
      waitIntervalInMs,
      useTransactionTimeoutIfAvailable,
    } = { ...DEFAULT_OPTIONS, ...options };

    assertRequiredArgs(
      { transaction, rpc },
      (argName: string) => new ERROR.MISSING_ARG(input, argName),
    );

    assert(
      timeoutInSeconds >= 1,
      new ERROR.TIMEOUT_TOO_LOW(input, timeoutInSeconds),
    );

    assert(
      waitIntervalInMs >= 100,
      new ERROR.WAIT_INTERVAL_TOO_LOW(input, waitIntervalInMs),
    );

    let sendResponse: Api.SendTransactionResponse;

    try {
      sendResponse = await rpc.sendTransaction(transaction);
    } catch (e) {
      throw new ERROR.FAIL_TO_SEND_TRANSACTION(input, e as Error);
    }

    const txHash = sendResponse.hash;

    if (sendResponse.status !== SendTransactionStatus.PENDING) {
      if (sendResponse.status === SendTransactionStatus.DUPLICATE) {
        throw new ERROR.DUPLICATE_TRANSACTION(input, txHash);
      }

      if (sendResponse.status === SendTransactionStatus.TRY_AGAIN_LATER) {
        throw new ERROR.TRY_AGAIN_LATER(input, txHash);
      }

      if (sendResponse.status === SendTransactionStatus.ERROR) {
        throw new ERROR.ERROR_STATUS(
          input,
          txHash,
          sendResponse.errorResult,
          sendResponse.diagnosticEvents,
        );
      }

      throw new ERROR.UNEXPECTED_STATUS(input, txHash, sendResponse.status);
    }

    const secondsToWait = useTransactionTimeoutIfAvailable
      ? getTransactionTimeout(transaction) || timeoutInSeconds
      : timeoutInSeconds;

    const waitUntil = Date.now() + secondsToWait * 1000;

    const getTxResponse = (
      await getTransactionRecursively(rpc, txHash, waitUntil, waitIntervalInMs)
    ).unwrap(input);

    if (getTxResponse.status === Api.GetTransactionStatus.SUCCESS) {
      return {
        hash: txHash,
        returnValue: getTxResponse.returnValue,
        ledger: getTxResponse.ledger,
        createdAt: getTxResponse.createdAt,
        response: getTxResponse,
      };
    }

    if (getTxResponse.status === Api.GetTransactionStatus.FAILED) {
      throw new ERROR.TRANSACTION_FAILED(input, txHash, getTxResponse);
    }

    if (getTxResponse.status === Api.GetTransactionStatus.NOT_FOUND) {
      throw new ERROR.TRANSACTION_NOT_FOUND(input, txHash);
    }

    // If no known status matched, throw unexpected status error
    throw new ERROR.UNEXPECTED_STATUS(
      input,
      txHash,
      (getTxResponse as Api.GetTransactionResponse).status,
    );
  } catch (e) {
    if (e instanceof ERROR.SendTransactionError) {
      throw e;
    }
    throw new ERROR.UNEXPECTED_ERROR(input, e as Error);
  }
};

const getTransactionRecursively = async (
  rpc: Server,
  hash: string,
  waitUntil: number,
  waitIntervalInMs: number,
): Promise<
  ResultOrError<
    Api.GetTransactionResponse,
    SendTransactionInput,
    ERROR.SendTransactionError
  >
> => {
  let getTxResponse: Api.GetTransactionResponse;

  try {
    getTxResponse = await rpc.getTransaction(hash);
  } catch (e) {
    return ERROR.FAILED_TO_GET_TRANSACTION_STATUS.deferInput(hash, e as Error);
  }

  const hasTimedOut = Date.now() >= waitUntil;
  const hasTxAchievedFinalStatus =
    getTxResponse.status !== Api.GetTransactionStatus.NOT_FOUND;

  if (!hasTimedOut && !hasTxAchievedFinalStatus) {
    await new Promise((resolve) => setTimeout(resolve, waitIntervalInMs));
    return getTransactionRecursively(rpc, hash, waitUntil, waitIntervalInMs);
  }
  return ResultOrError.wrapVal(getTxResponse);
};
/** Error constructors emitted by {@link sendTransaction}. */
export const SendTransactionErrors: typeof ERROR = ERROR;
