import { type Operation, type OperationRecord, xdr } from "stellar-sdk";
import { muxedAddressToBaseAccount } from "@/address/index.ts";
import * as E from "@/auth/requirements/classic-operation-threshold/error.ts";
import { ColibriError } from "@/error/index.ts";
import {
  OperationThreshold,
  type SignatureRequirementRaw,
} from "@/signer/types.ts";
import type { Ed25519PublicKey, MuxedAddress } from "@/strkeys/types.ts";
import { StrKey } from "@/strkeys/index.ts";

const setSourceSigner = (
  source?: string,
): SignatureRequirementRaw["address"] => {
  if (!source) {
    return "source-account";
  }

  if (source && StrKey.isEd25519PublicKey(source)) {
    return source as Ed25519PublicKey;
  }

  if (source && StrKey.isMuxedAddress(source)) {
    return muxedAddressToBaseAccount(
      source as MuxedAddress,
    ) as Ed25519PublicKey;
  }

  throw ColibriError.unexpected({
    message:
      `Invalid source account: '${source}' does not fit the expected format`,
  });
};

const LOW_THRESHOLD_OPERATIONS = new Set<string>([
  xdr.OperationType.allowTrust.name,
  xdr.OperationType.bumpSequence.name,
  xdr.OperationType.setTrustLineFlags.name,
]);

const MEDIUM_THRESHOLD_OPERATIONS = new Set<string>([
  xdr.OperationType.createAccount.name,
  xdr.OperationType.payment.name,
  xdr.OperationType.pathPaymentStrictSend.name,
  xdr.OperationType.pathPaymentStrictReceive.name,
  xdr.OperationType.manageSellOffer.name,
  xdr.OperationType.manageBuyOffer.name,
  xdr.OperationType.createPassiveSellOffer.name,
  xdr.OperationType.changeTrust.name,
  xdr.OperationType.manageData.name,
  xdr.OperationType.createClaimableBalance.name,
  xdr.OperationType.claimClaimableBalance.name,
  xdr.OperationType.beginSponsoringFutureReserves.name,
  xdr.OperationType.endSponsoringFutureReserves.name,
  xdr.OperationType.clawback.name,
  xdr.OperationType.clawbackClaimableBalance.name,
  xdr.OperationType.liquidityPoolDeposit.name,
  xdr.OperationType.liquidityPoolWithdraw.name,
  "revokeAccountSponsorship",
  "revokeTrustlineSponsorship",
  "revokeOfferSponsorship",
  "revokeDataSponsorship",
  "revokeClaimableBalanceSponsorship",
  "revokeLiquidityPoolSponsorship",
  "revokeSignerSponsorship",
  xdr.OperationType.revokeSponsorship.name,
]);

const setOptionsRequiresHighThreshold = (
  operation: Operation.SetOptions,
): boolean =>
  operation.masterWeight !== undefined ||
  operation.signer !== undefined ||
  operation.lowThreshold !== undefined ||
  operation.medThreshold !== undefined ||
  operation.highThreshold !== undefined;

const getThresholdLevel = (
  operation: OperationRecord,
): OperationThreshold | undefined => {
  if (LOW_THRESHOLD_OPERATIONS.has(operation.type)) {
    return OperationThreshold.low;
  }
  if (MEDIUM_THRESHOLD_OPERATIONS.has(operation.type)) {
    return OperationThreshold.medium;
  }
  if (operation.type === xdr.OperationType.accountMerge.name) {
    return OperationThreshold.high;
  }
  if (operation.type !== xdr.OperationType.setOptions.name) return;

  return setOptionsRequiresHighThreshold(operation as Operation.SetOptions)
    ? OperationThreshold.high
    : OperationThreshold.medium;
};

const getOperationSigner = (
  operation: OperationRecord,
): SignatureRequirementRaw["address"] => {
  try {
    return setSourceSigner(operation.source);
  } catch (error) {
    throw new E.FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE(
      operation,
      operation.source,
      error as Error,
    );
  }
};

/** Returns the signer threshold required for a classic Stellar operation. */
export const getRequiredOperationThresholdForClassicOperation = (
  operation: OperationRecord,
): SignatureRequirementRaw | void => {
  try {
    const thresholdLevel = getThresholdLevel(operation);
    if (thresholdLevel === undefined) return;

    return { address: getOperationSigner(operation), thresholdLevel };
  } catch (e) {
    if (e instanceof E.ClassicOperationThresholdError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(operation, e as Error);
  }
};
