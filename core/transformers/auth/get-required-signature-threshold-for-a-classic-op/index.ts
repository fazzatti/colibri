import { type Operation, xdr } from "stellar-sdk";
import { muxedAddressToBaseAccount } from "../../address/index.ts";
import type { TransformerSync } from "convee";
import * as E from "./error.ts";
import { ColibriError } from "../../../mod.ts";
import {
  OperationThreshold,
  type SignatureRequirementRaw,
} from "../../../signer/types.ts";
import type { Ed25519PublicKey, MuxedAddress } from "../../../strkeys/types.ts";
import { StrKey } from "../../../strkeys/index.ts";

const setSourceSigner = (
  source?: string
): SignatureRequirementRaw["address"] => {
  if (!source) {
    return "source-account";
  }

  if (source && StrKey.isEd25519PublicKey(source)) {
    return source as Ed25519PublicKey;
  }

  if (source && StrKey.isMuxedAddress(source)) {
    return muxedAddressToBaseAccount(
      source as MuxedAddress
    ) as Ed25519PublicKey;
  }

  throw ColibriError.unexpected({
    message: `Invalid source account: '${source}' does not fit the expected format`,
  });
};

export const getRequiredOperationThresholdForClassicOperation: TransformerSync<
  Operation,
  SignatureRequirementRaw | void
> = (operation: Operation): SignatureRequirementRaw | void => {
  try {
    let thresholdLevel = OperationThreshold.medium;
    let source;

    switch (operation.type as string) {
      case xdr.OperationType.allowTrust().name:
      case xdr.OperationType.bumpSequence().name:
      case xdr.OperationType.setTrustLineFlags().name:
        thresholdLevel = OperationThreshold.low;
        source = operation.source;
        break;

      case xdr.OperationType.createAccount().name:
      case xdr.OperationType.payment().name:
      case xdr.OperationType.pathPaymentStrictSend().name:
      case xdr.OperationType.pathPaymentStrictReceive().name:
      case xdr.OperationType.manageSellOffer().name:
      case xdr.OperationType.manageBuyOffer().name:
      case xdr.OperationType.createPassiveSellOffer().name:
      case xdr.OperationType.changeTrust().name:
      case xdr.OperationType.manageData().name:
      case xdr.OperationType.createClaimableBalance().name:
      case xdr.OperationType.claimClaimableBalance().name:
      case xdr.OperationType.beginSponsoringFutureReserves().name:
      case xdr.OperationType.endSponsoringFutureReserves().name:
      case xdr.OperationType.clawback().name:
      case xdr.OperationType.clawbackClaimableBalance().name:
      case xdr.OperationType.liquidityPoolDeposit().name:
      case xdr.OperationType.liquidityPoolWithdraw().name:
        source = operation.source;
        break;
      case xdr.OperationType.revokeSponsorship().name:
      case "revokeAccountSponsorship":
      case "revokeTrustlineSponsorship":
      case "revokeOfferSponsorship":
      case "revokeDataSponsorship":
      case "revokeClaimableBalanceSponsorship":
      case "revokeLiquidityPoolSponsorship":
      case "revokeSignerSponsorship":
        source = operation.source;
        break;
      case xdr.OperationType.setOptions().name:
        if (
          (operation as Operation.SetOptions).masterWeight ||
          (operation as Operation.SetOptions).signer ||
          (operation as Operation.SetOptions).lowThreshold ||
          (operation as Operation.SetOptions).medThreshold ||
          (operation as Operation.SetOptions).highThreshold
        ) {
          thresholdLevel = OperationThreshold.high;
        }
        source = operation.source;
        break;
      case xdr.OperationType.accountMerge().name:
        thresholdLevel = OperationThreshold.high;
        source = operation.source;
        break;

      default:
        return;
    }

    try {
      const address = setSourceSigner(source);
      return { address, thresholdLevel };
    } catch (e) {
      throw new E.FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE(
        operation,
        source,
        e as Error
      );
    }
  } catch (e) {
    if (e instanceof E.GetRequiredSignatureThresholdForClassicOperationError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(operation, e as Error);
  }
};
