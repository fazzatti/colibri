import { ProcessEngine } from "convee";
import {
  DEFAULT_OPTIONS,
  SendTransactionStatus,
  type SendTransactionInput,
  type SendTransactionOutput,
} from "./types.ts";
import * as E from "./error.ts";

import { assertRequiredArgs } from "../../common/assert/assert-args.ts";
import { Api, type Server } from "stellar-sdk/rpc";
import { assert } from "../../common/assert/assert.ts";
import { getTransactionTimeout } from "../../common/helpers/transaction.ts";
import { ResultOrError } from "../../common/deferred/result-or-error.ts";

const sendTransactionProcess = async (
  input: SendTransactionInput
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
      (argName: string) => new E.MISSING_ARG(input, argName)
    );

    assert(
      timeoutInSeconds >= 1,
      new E.TIMEOUT_TOO_LOW(input, timeoutInSeconds)
    );

    assert(
      waitIntervalInMs >= 100,
      new E.WAIT_INTERVAL_TOO_LOW(input, waitIntervalInMs)
    );

    let sendResponse: Api.SendTransactionResponse;

    try {
      sendResponse = await rpc.sendTransaction(transaction);
    } catch (e) {
      throw new E.FAIL_TO_SEND_TRANSACTION(input, e as Error);
    }

    const txHash = sendResponse.hash;

    if (sendResponse.status !== SendTransactionStatus.PENDING) {
      if (sendResponse.status === SendTransactionStatus.DUPLICATE)
        throw new E.DUPLICATE_TRANSACTION(input, txHash);

      if (sendResponse.status === SendTransactionStatus.TRY_AGAIN_LATER)
        throw new E.TRY_AGAIN_LATER(input, txHash);

      if (sendResponse.status === SendTransactionStatus.ERROR)
        throw new E.ERROR_STATUS(
          input,
          txHash,
          sendResponse.errorResult,
          sendResponse.diagnosticEvents
        );

      throw new E.UNEXPECTED_STATUS(input, txHash, sendResponse.status);
    }

    const secondsToWait = useTransactionTimeoutIfAvailable
      ? getTransactionTimeout(transaction) || timeoutInSeconds
      : timeoutInSeconds;

    const waitUntil = Date.now() + secondsToWait * 1000;

    const getTxResponse = (
      await getTransactionRecursively(rpc, txHash, waitUntil, waitIntervalInMs)
    ).unwrap(input);

    if (getTxResponse.status === Api.GetTransactionStatus.SUCCESS)
      return {
        hash: txHash,
        returnValue: getTxResponse.returnValue,
        response: getTxResponse,
      };

    if (getTxResponse.status === Api.GetTransactionStatus.FAILED)
      throw new E.TRANSACTION_FAILED(input, txHash, getTxResponse);

    if (getTxResponse.status === Api.GetTransactionStatus.NOT_FOUND)
      throw new E.TRANSACTION_NOT_FOUND(input, txHash);

    // If no known status matched, throw unexpected status error
    throw new E.UNEXPECTED_STATUS(
      input,
      txHash,
      (getTxResponse as Api.GetTransactionResponse).status
    );
  } catch (e) {
    if (e instanceof E.SendTransactionError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};

const getTransactionRecursively = async (
  rpc: Server,
  hash: string,
  waitUntil: number,
  waitIntervalInMs: number
): Promise<
  ResultOrError<
    Api.GetTransactionResponse,
    SendTransactionInput,
    E.SendTransactionError
  >
> => {
  let getTxResponse: Api.GetTransactionResponse;

  try {
    getTxResponse = await rpc.getTransaction(hash);
  } catch (e) {
    return E.FAILED_TO_GET_TRANSACTION_STATUS.deferInput(hash, e as Error);
  }

  const hasTimedOut = Date.now() >= waitUntil;
  const hasTxAchievedFinalStatus =
    getTxResponse.status !== Api.GetTransactionStatus.NOT_FOUND;

  if (!hasTimedOut && !hasTxAchievedFinalStatus)
    return getTransactionRecursively(rpc, hash, waitUntil, waitIntervalInMs);

  return ResultOrError.wrapVal(getTxResponse);
};

const SendTransaction = ProcessEngine.create<
  SendTransactionInput,
  SendTransactionOutput,
  E.SendTransactionError
>(sendTransactionProcess, { name: "SendTransaction" });

export { SendTransaction };
