import type { xdr } from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import * as E from "@/processes/parse-classic-transaction-outcome/error.ts";
import type {
  ClassicOperationOutcome,
  ParseClassicTransactionOutcomeInput,
  ParseClassicTransactionOutcomeOutput,
} from "@/processes/parse-classic-transaction-outcome/types.ts";

const OPERATION_SUCCESS_TYPES = {
  createAccount: "createAccountSuccess",
  payment: "paymentSuccess",
  pathPaymentStrictReceive: "pathPaymentStrictReceiveSuccess",
  manageSellOffer: "manageSellOfferSuccess",
  createPassiveSellOffer: "manageSellOfferSuccess",
  setOptions: "setOptionsSuccess",
  changeTrust: "changeTrustSuccess",
  allowTrust: "allowTrustSuccess",
  accountMerge: "accountMergeSuccess",
  inflation: "inflationSuccess",
  manageData: "manageDataSuccess",
  bumpSequence: "bumpSequenceSuccess",
  manageBuyOffer: "manageBuyOfferSuccess",
  pathPaymentStrictSend: "pathPaymentStrictSendSuccess",
  createClaimableBalance: "createClaimableBalanceSuccess",
  claimClaimableBalance: "claimClaimableBalanceSuccess",
  beginSponsoringFutureReserves: "beginSponsoringFutureReservesSuccess",
  endSponsoringFutureReserves: "endSponsoringFutureReservesSuccess",
  revokeSponsorship: "revokeSponsorshipSuccess",
  clawback: "clawbackSuccess",
  clawbackClaimableBalance: "clawbackClaimableBalanceSuccess",
  setTrustLineFlags: "setTrustLineFlagsSuccess",
  liquidityPoolDeposit: "liquidityPoolDepositSuccess",
  liquidityPoolWithdraw: "liquidityPoolWithdrawSuccess",
  invokeHostFunction: "invokeHostFunctionSuccess",
  extendFootprintTtl: "extendFootprintTtlSuccess",
  restoreFootprint: "restoreFootprintSuccess",
} as const;

const getOperationResults = (
  input: ParseClassicTransactionOutcomeInput,
): xdr.OperationResult[] => {
  const transactionResult = input.response.resultXdr.result;
  if (transactionResult.type === "txSuccess") {
    return transactionResult.results;
  }

  if (transactionResult.type !== "txFeeBumpInnerSuccess") {
    throw new E.UNEXPECTED_TRANSACTION_RESULT_ERROR(
      input,
      transactionResult.type,
    );
  }

  const innerResult = transactionResult.innerResultPair.result.result;
  assert(
    innerResult.type === "txSuccess",
    new E.UNEXPECTED_INNER_TRANSACTION_RESULT_ERROR(input, innerResult.type),
  );
  return innerResult.results;
};

const parseOperationOutcome = (
  input: ParseClassicTransactionOutcomeInput,
  operationResult: xdr.OperationResult,
  index: number,
): ClassicOperationOutcome => {
  assert(
    operationResult.type === "opInner",
    new E.UNEXPECTED_OPERATION_RESULT_ERROR(
      input,
      index,
      operationResult.type,
    ),
  );

  const typedResult = operationResult.tr;
  const expectedResultType = OPERATION_SUCCESS_TYPES[typedResult.type];
  assert(
    expectedResultType !== undefined,
    new E.UNSUPPORTED_OPERATION_OUTCOME_ERROR(input, index, typedResult.type),
  );

  const result = typedResult.value;
  assert(
    result.type === expectedResultType,
    new E.UNSUCCESSFUL_OPERATION_OUTCOME_ERROR(
      input,
      index,
      typedResult.type,
      result.type,
      expectedResultType,
    ),
  );

  return {
    index,
    type: typedResult.type,
    result,
  } as ClassicOperationOutcome;
};

/**
 * Extracts runtime-discriminated successful classic operation outcomes from a
 * confirmed RPC response.
 */
export const parseClassicTransactionOutcome = (
  input: ParseClassicTransactionOutcomeInput,
): ParseClassicTransactionOutcomeOutput => {
  try {
    const operationResults = getOperationResults(input);
    return {
      ...input,
      feeCharged: input.response.resultXdr.feeCharged,
      operations: operationResults.map((result, index) =>
        parseOperationOutcome(input, result, index)
      ),
    };
  } catch (error) {
    if (error instanceof E.ParseClassicTransactionOutcomeError) throw error;
    throw new E.UNEXPECTED_ERROR(input, error as Error);
  }
};

/** Error constructors emitted by {@link parseClassicTransactionOutcome}. */
export const ParseClassicTransactionOutcomeErrors: typeof E = E;
