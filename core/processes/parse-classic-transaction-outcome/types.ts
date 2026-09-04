import type { OperationResultTr } from "@/common/types/index.ts";
import type { SendTransactionOutput } from "@/processes/send-transaction/types.ts";

/**
 * Successful result of one confirmed classic operation.
 *
 * `type` is the Stellar operation-result discriminant. Narrowing it also
 * narrows `result` to the corresponding successful Stellar SDK XDR result.
 * `index` is zero-based and matches the operation's position in the submitted
 * transaction.
 */
export type ClassicOperationOutcome = {
  [Type in OperationResultTr["type"]]: {
    /** Zero-based operation position in the submitted transaction. */
    index: number;
    /** Stellar operation-result discriminant. */
    type: Type;
    /** Successful Stellar SDK XDR result for this operation type. */
    result: Extract<
      Extract<OperationResultTr, { type: Type }>["value"],
      {
        type: {
          createAccount: "createAccountSuccess";
          payment: "paymentSuccess";
          pathPaymentStrictReceive: "pathPaymentStrictReceiveSuccess";
          manageSellOffer: "manageSellOfferSuccess";
          createPassiveSellOffer: "manageSellOfferSuccess";
          setOptions: "setOptionsSuccess";
          changeTrust: "changeTrustSuccess";
          allowTrust: "allowTrustSuccess";
          accountMerge: "accountMergeSuccess";
          inflation: "inflationSuccess";
          manageData: "manageDataSuccess";
          bumpSequence: "bumpSequenceSuccess";
          manageBuyOffer: "manageBuyOfferSuccess";
          pathPaymentStrictSend: "pathPaymentStrictSendSuccess";
          createClaimableBalance: "createClaimableBalanceSuccess";
          claimClaimableBalance: "claimClaimableBalanceSuccess";
          beginSponsoringFutureReserves: "beginSponsoringFutureReservesSuccess";
          endSponsoringFutureReserves: "endSponsoringFutureReservesSuccess";
          revokeSponsorship: "revokeSponsorshipSuccess";
          clawback: "clawbackSuccess";
          clawbackClaimableBalance: "clawbackClaimableBalanceSuccess";
          setTrustLineFlags: "setTrustLineFlagsSuccess";
          liquidityPoolDeposit: "liquidityPoolDepositSuccess";
          liquidityPoolWithdraw: "liquidityPoolWithdrawSuccess";
          invokeHostFunction: "invokeHostFunctionSuccess";
          extendFootprintTtl: "extendFootprintTtlSuccess";
          restoreFootprint: "restoreFootprintSuccess";
        }[Type];
      }
    >;
  };
}[OperationResultTr["type"]];

/** Input accepted by the classic-outcome parser. */
export type ParseClassicTransactionOutcomeInput = SendTransactionOutput;

/**
 * Successful classic submission enriched with protocol-native outcomes.
 */
export type ParseClassicTransactionOutcomeOutput = SendTransactionOutput & {
  /** Total fee charged by Stellar for the confirmed transaction. */
  feeCharged: bigint;
  /** Runtime-typed successful operation results in submission order. */
  operations: ClassicOperationOutcome[];
};
