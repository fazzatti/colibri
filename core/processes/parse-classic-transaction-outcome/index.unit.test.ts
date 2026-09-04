import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { parseClassicTransactionOutcome } from "@/processes/parse-classic-transaction-outcome/index.ts";
import * as E from "@/processes/parse-classic-transaction-outcome/error.ts";
import type { SendTransactionOutput } from "@/processes/send-transaction/types.ts";

const manageOfferSuccess = new xdr.ManageOfferSuccessResult({
  offersClaimed: [],
  offer: xdr.ManageOfferSuccessResultOffer.manageOfferDeleted(),
});

const simplePayment = new xdr.SimplePaymentResult({
  destination: xdr.PublicKey.publicKeyTypeEd25519(new Uint8Array(32)),
  asset: xdr.Asset.assetTypeNative(),
  amount: 1n,
});

const successfulOperationResults: xdr.OperationResultTr[] = [
  xdr.OperationResultTr.createAccount(
    xdr.CreateAccountResult.createAccountSuccess(),
  ),
  xdr.OperationResultTr.payment(xdr.PaymentResult.paymentSuccess()),
  xdr.OperationResultTr.pathPaymentStrictReceive(
    xdr.PathPaymentStrictReceiveResult.pathPaymentStrictReceiveSuccess(
      new xdr.PathPaymentStrictReceiveResultSuccess({
        offers: [],
        last: simplePayment,
      }),
    ),
  ),
  xdr.OperationResultTr.manageSellOffer(
    xdr.ManageSellOfferResult.manageSellOfferSuccess(manageOfferSuccess),
  ),
  xdr.OperationResultTr.createPassiveSellOffer(
    xdr.ManageSellOfferResult.manageSellOfferSuccess(manageOfferSuccess),
  ),
  xdr.OperationResultTr.setOptions(xdr.SetOptionsResult.setOptionsSuccess()),
  xdr.OperationResultTr.changeTrust(xdr.ChangeTrustResult.changeTrustSuccess()),
  xdr.OperationResultTr.allowTrust(xdr.AllowTrustResult.allowTrustSuccess()),
  xdr.OperationResultTr.accountMerge(
    xdr.AccountMergeResult.accountMergeSuccess(100n),
  ),
  xdr.OperationResultTr.inflation(
    xdr.InflationResult.inflationSuccess([]),
  ),
  xdr.OperationResultTr.manageData(xdr.ManageDataResult.manageDataSuccess()),
  xdr.OperationResultTr.bumpSequence(
    xdr.BumpSequenceResult.bumpSequenceSuccess(),
  ),
  xdr.OperationResultTr.manageBuyOffer(
    xdr.ManageBuyOfferResult.manageBuyOfferSuccess(manageOfferSuccess),
  ),
  xdr.OperationResultTr.pathPaymentStrictSend(
    xdr.PathPaymentStrictSendResult.pathPaymentStrictSendSuccess(
      new xdr.PathPaymentStrictSendResultSuccess({
        offers: [],
        last: simplePayment,
      }),
    ),
  ),
  xdr.OperationResultTr.createClaimableBalance(
    xdr.CreateClaimableBalanceResult.createClaimableBalanceSuccess(
      xdr.ClaimableBalanceId.claimableBalanceIdTypeV0(new Uint8Array(32)),
    ),
  ),
  xdr.OperationResultTr.claimClaimableBalance(
    xdr.ClaimClaimableBalanceResult.claimClaimableBalanceSuccess(),
  ),
  xdr.OperationResultTr.beginSponsoringFutureReserves(
    xdr.BeginSponsoringFutureReservesResult
      .beginSponsoringFutureReservesSuccess(),
  ),
  xdr.OperationResultTr.endSponsoringFutureReserves(
    xdr.EndSponsoringFutureReservesResult.endSponsoringFutureReservesSuccess(),
  ),
  xdr.OperationResultTr.revokeSponsorship(
    xdr.RevokeSponsorshipResult.revokeSponsorshipSuccess(),
  ),
  xdr.OperationResultTr.clawback(xdr.ClawbackResult.clawbackSuccess()),
  xdr.OperationResultTr.clawbackClaimableBalance(
    xdr.ClawbackClaimableBalanceResult.clawbackClaimableBalanceSuccess(),
  ),
  xdr.OperationResultTr.setTrustLineFlags(
    xdr.SetTrustLineFlagsResult.setTrustLineFlagsSuccess(),
  ),
  xdr.OperationResultTr.liquidityPoolDeposit(
    xdr.LiquidityPoolDepositResult.liquidityPoolDepositSuccess(),
  ),
  xdr.OperationResultTr.liquidityPoolWithdraw(
    xdr.LiquidityPoolWithdrawResult.liquidityPoolWithdrawSuccess(),
  ),
  xdr.OperationResultTr.invokeHostFunction(
    xdr.InvokeHostFunctionResult.invokeHostFunctionSuccess(new Uint8Array(32)),
  ),
  xdr.OperationResultTr.extendFootprintTtl(
    xdr.ExtendFootprintTtlResult.extendFootprintTtlSuccess(),
  ),
  xdr.OperationResultTr.restoreFootprint(
    xdr.RestoreFootprintResult.restoreFootprintSuccess(),
  ),
];

const expectedOperationTypes = successfulOperationResults.map((result) =>
  result.type
);

const transactionResult = (
  result: xdr.TransactionResultResult,
  feeCharged = 100n,
): xdr.TransactionResult =>
  new xdr.TransactionResult({
    feeCharged,
    result,
    ext: xdr.TransactionResultExt.v0(),
  });

const inputFor = (
  result: xdr.TransactionResult,
): SendTransactionOutput => ({
  hash: "transaction-hash",
  returnValue: undefined,
  ledger: 123,
  createdAt: 456,
  response: {
    resultXdr: result,
  } as Api.GetSuccessfulTransactionResponse,
});

const operationResults = (results: xdr.OperationResultTr[]) =>
  results.map((result) => xdr.OperationResult.opInner(result));

describe("parseClassicTransactionOutcome", () => {
  it("returns every successful operation result as a typed runtime outcome", () => {
    const input = inputFor(
      transactionResult(
        xdr.TransactionResultResult.txSuccess(
          operationResults(successfulOperationResults),
        ),
        321n,
      ),
    );

    const output = parseClassicTransactionOutcome(input);

    assertEquals(output.hash, input.hash);
    assertEquals(output.ledger, input.ledger);
    assertEquals(output.createdAt, input.createdAt);
    assertEquals(output.response, input.response);
    assertEquals(output.feeCharged, 321n);
    assertEquals(
      output.operations.map((outcome) => outcome.index),
      expectedOperationTypes.map((_, index) => index),
    );
    assertEquals(
      output.operations.map((outcome) => outcome.type),
      expectedOperationTypes,
    );
    assertEquals(
      output.operations.map((outcome) => outcome.result.type),
      successfulOperationResults.map((result) => result.value.type),
    );
  });

  it("unwraps successful operation outcomes from a fee-bump result", () => {
    const innerResult = new xdr.InnerTransactionResult({
      feeCharged: 0n,
      result: xdr.InnerTransactionResultResult.txSuccess(
        operationResults([successfulOperationResults[1]]),
      ),
      ext: xdr.InnerTransactionResultExt.v0(),
    });
    const resultPair = new xdr.InnerTransactionResultPair({
      transactionHash: new Uint8Array(32),
      result: innerResult,
    });
    const input = inputFor(
      transactionResult(
        xdr.TransactionResultResult.txFeeBumpInnerSuccess(resultPair),
      ),
    );

    const output = parseClassicTransactionOutcome(input);

    assertEquals(output.operations[0].type, "payment");
  });

  it("rejects a transaction result that is not successful", () => {
    const input = inputFor(
      transactionResult(xdr.TransactionResultResult.txFailed([])),
    );

    assertThrows(
      () => parseClassicTransactionOutcome(input),
      E.UNEXPECTED_TRANSACTION_RESULT_ERROR,
    );
  });

  it("rejects a fee bump whose inner result is not successful", () => {
    const innerResult = new xdr.InnerTransactionResult({
      feeCharged: 0n,
      result: xdr.InnerTransactionResultResult.txFailed([]),
      ext: xdr.InnerTransactionResultExt.v0(),
    });
    const resultPair = new xdr.InnerTransactionResultPair({
      transactionHash: new Uint8Array(32),
      result: innerResult,
    });
    const input = inputFor(
      transactionResult(
        xdr.TransactionResultResult.txFeeBumpInnerSuccess(resultPair),
      ),
    );

    assertThrows(
      () => parseClassicTransactionOutcome(input),
      E.UNEXPECTED_INNER_TRANSACTION_RESULT_ERROR,
    );
  });

  it("rejects an operation result without an inner protocol result", () => {
    const input = inputFor(
      transactionResult(
        xdr.TransactionResultResult.txSuccess([
          xdr.OperationResult.opBadAuth(),
        ]),
      ),
    );

    assertThrows(
      () => parseClassicTransactionOutcome(input),
      E.UNEXPECTED_OPERATION_RESULT_ERROR,
    );
  });

  it("rejects operation types unknown to the parser", () => {
    const futureResult = {
      type: "opInner",
      tr: {
        type: "futureOperation",
        value: { type: "futureOperationSuccess" },
      },
    } as unknown as xdr.OperationResult;
    const input = inputFor(
      transactionResult(
        xdr.TransactionResultResult.txSuccess([futureResult]),
      ),
    );

    assertThrows(
      () => parseClassicTransactionOutcome(input),
      E.UNSUPPORTED_OPERATION_OUTCOME_ERROR,
    );
  });

  it("rejects an operation result that is not successful", () => {
    const failedPayment = xdr.OperationResult.opInner(
      xdr.OperationResultTr.payment(
        xdr.PaymentResult.paymentNoDestination(),
      ),
    );
    const input = inputFor(
      transactionResult(
        xdr.TransactionResultResult.txSuccess([failedPayment]),
      ),
    );

    assertThrows(
      () => parseClassicTransactionOutcome(input),
      E.UNSUCCESSFUL_OPERATION_OUTCOME_ERROR,
    );
  });

  it("wraps unrecognized input failures", () => {
    assertThrows(
      () =>
        parseClassicTransactionOutcome(
          null as unknown as SendTransactionOutput,
        ),
      E.UNEXPECTED_ERROR,
    );
  });
});
