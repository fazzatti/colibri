// deno-coverage-ignore-start — Babel decorator helpers are injected at line 1 during transpilation; this excludes them from coverage
/**
 * @module ledger-parser/operation
 * @description Operation class with type delegation for all Stellar operations
 */

import { memoize } from "@/common/decorators/memoize/index.ts";
// deno-coverage-ignore-stop
import type { xdr } from "stellar-sdk";
import {
  parseAsset,
  parseChangeTrustAsset,
  parseAccountId,
  parseMuxedAccount,
} from "@/common/helpers/xdr/index.ts";
import {
  INVALID_OPERATION_INDEX,
  UNSUPPORTED_OPERATION_TYPE,
} from "@/ledger-parser/error.ts";
import type { Transaction } from "@/ledger-parser/transaction/index.ts";

/**
 * Operation class with type-specific parsing delegation
 *
 * Supports all ~20 Stellar operation types with switch-case delegation.
 *
 * @example
 * ```typescript
 * const op = tx.operations[0];
 * op.type;           // "payment"
 * op.sourceAccount;  // Parse source account
 * op.body;           // Parse operation-specific data (memoized)
 * ```
 */
export class Operation {
  readonly index: number;
  private readonly transaction: Transaction;
  private readonly rawOperation: xdr.Operation;

  private constructor(
    transaction: Transaction,
    rawOperation: xdr.Operation,
    index: number
  ) {
    this.transaction = transaction;
    this.rawOperation = rawOperation;
    this.index = index;
  }

  /**
   * Factory method to create an Operation from XDR
   */
  static fromXdr(
    transaction: Transaction,
    rawOperation: xdr.Operation,
    index: number
  ): Operation {
    if (index < 0) {
      throw new INVALID_OPERATION_INDEX(index, transaction.index, -1);
    }
    return new Operation(transaction, rawOperation, index);
  }

  /**
   * Get the operation type
   */
  @memoize()
  get type(): string {
    const typeCode = this.rawOperation.body().switch().value;
    // Map numeric codes to operation type names
    const typeMap: Record<number, string> = {
      0: "createAccount",
      1: "payment",
      2: "pathPaymentStrictReceive",
      3: "manageSellOffer",
      4: "createPassiveSellOffer",
      5: "setOptions",
      6: "changeTrust",
      7: "allowTrust",
      8: "accountMerge",
      9: "inflation",
      10: "manageData",
      11: "bumpSequence",
      12: "manageBuyOffer",
      13: "pathPaymentStrictSend",
      14: "createClaimableBalance",
      15: "claimClaimableBalance",
      16: "beginSponsoringFutureReserves",
      17: "endSponsoringFutureReserves",
      18: "revokeSponsorship",
      19: "clawback",
      20: "clawbackClaimableBalance",
      21: "setTrustLineFlags",
      22: "liquidityPoolDeposit",
      23: "liquidityPoolWithdraw",
      24: "invokeHostFunction",
      25: "extendFootprintTtl",
      26: "restoreFootprint",
    };
    return typeMap[typeCode] || `unknown_${typeCode}`;
  }

  /**
   * Get the source account (falls back to transaction source if not specified)
   */
  @memoize()
  get sourceAccount(): string {
    const opSource = this.rawOperation.sourceAccount();
    if (opSource) {
      return parseMuxedAccount(opSource);
    }
    return this.transaction.sourceAccount;
  }

  /**
   * Parse the operation body based on type
   *
   * Uses switch-case delegation to handle ~20 operation types.
   *
   * @memoized - Expensive parsing is cached
   */
  @memoize()
  get body(): unknown {
    const opBody = this.rawOperation.body();
    const opType = this.type; // Already mapped to string

    switch (opType) {
      case "createAccount":
        return this.parseCreateAccount(opBody.createAccountOp());

      case "payment":
        return this.parsePayment(opBody.paymentOp());

      case "pathPaymentStrictReceive":
        return this.parsePathPaymentStrictReceive(
          opBody.pathPaymentStrictReceiveOp()
        );

      case "pathPaymentStrictSend":
        return this.parsePathPaymentStrictSend(
          opBody.pathPaymentStrictSendOp()
        );

      case "manageSellOffer":
        return this.parseManageSellOffer(opBody.manageSellOfferOp());

      case "manageBuyOffer":
        return this.parseManageBuyOffer(opBody.manageBuyOfferOp());

      case "createPassiveSellOffer":
        return this.parseCreatePassiveSellOffer(
          opBody.createPassiveSellOfferOp()
        );

      case "setOptions":
        return this.parseSetOptions(opBody.setOptionsOp());

      case "changeTrust":
        return this.parseChangeTrust(opBody.changeTrustOp());

      case "allowTrust":
        return this.parseAllowTrust(opBody.allowTrustOp());

      case "accountMerge":
        return this.parseAccountMerge(opBody.destination());

      case "inflation":
        return {}; // No body for inflation

      case "manageData":
        return this.parseManageData(opBody.manageDataOp());

      case "bumpSequence":
        return this.parseBumpSequence(opBody.bumpSequenceOp());

      case "createClaimableBalance":
        return this.parseCreateClaimableBalance(
          opBody.createClaimableBalanceOp()
        );

      case "claimClaimableBalance":
        return this.parseClaimClaimableBalance(
          opBody.claimClaimableBalanceOp()
        );

      case "beginSponsoringFutureReserves":
        return this.parseBeginSponsoringFutureReserves(
          opBody.beginSponsoringFutureReservesOp()
        );

      case "endSponsoringFutureReserves":
        return {}; // No body

      case "revokeSponsorship":
        return this.parseRevokeSponsorship(opBody.revokeSponsorshipOp());

      case "clawback":
        return this.parseClawback(opBody.clawbackOp());

      case "clawbackClaimableBalance":
        return this.parseClawbackClaimableBalance(
          opBody.clawbackClaimableBalanceOp()
        );

      case "setTrustLineFlags":
        return this.parseSetTrustLineFlags(opBody.setTrustLineFlagsOp());

      case "liquidityPoolDeposit":
        return this.parseLiquidityPoolDeposit(opBody.liquidityPoolDepositOp());

      case "liquidityPoolWithdraw":
        return this.parseLiquidityPoolWithdraw(
          opBody.liquidityPoolWithdrawOp()
        );

      case "invokeHostFunction":
        return this.parseInvokeHostFunction(opBody.invokeHostFunctionOp());

      case "extendFootprintTtl":
        return this.parseExtendFootprintTtl(opBody.extendFootprintTtlOp());

      case "restoreFootprint":
        return this.parseRestoreFootprint(opBody.restoreFootprintOp());

      default:
        throw new UNSUPPORTED_OPERATION_TYPE(opType);
    }
  }

  // ========== Operation-specific parsers ==========

  private parseCreateAccount(op: xdr.CreateAccountOp) {
    return {
      destination: parseAccountId(op.destination()),
      startingBalance: op.startingBalance().toString(),
    };
  }

  private parsePayment(op: xdr.PaymentOp) {
    return {
      destination: parseMuxedAccount(op.destination()),
      asset: parseAsset(op.asset()),
      amount: op.amount().toString(),
    };
  }

  private parsePathPaymentStrictReceive(op: xdr.PathPaymentStrictReceiveOp) {
    return {
      sendAsset: parseAsset(op.sendAsset()),
      sendMax: op.sendMax().toString(),
      destination: parseMuxedAccount(op.destination()),
      destAsset: parseAsset(op.destAsset()),
      destAmount: op.destAmount().toString(),
      path: op.path().map(parseAsset),
    };
  }

  private parsePathPaymentStrictSend(op: xdr.PathPaymentStrictSendOp) {
    return {
      sendAsset: parseAsset(op.sendAsset()),
      sendAmount: op.sendAmount().toString(),
      destination: parseMuxedAccount(op.destination()),
      destAsset: parseAsset(op.destAsset()),
      destMin: op.destMin().toString(),
      path: op.path().map(parseAsset),
    };
  }

  private parseManageSellOffer(op: xdr.ManageSellOfferOp) {
    return {
      selling: parseAsset(op.selling()),
      buying: parseAsset(op.buying()),
      amount: op.amount().toString(),
      price: {
        n: op.price().n(),
        d: op.price().d(),
      },
      offerId: op.offerId().toString(),
    };
  }

  private parseManageBuyOffer(op: xdr.ManageBuyOfferOp) {
    return {
      selling: parseAsset(op.selling()),
      buying: parseAsset(op.buying()),
      buyAmount: op.buyAmount().toString(),
      price: {
        n: op.price().n(),
        d: op.price().d(),
      },
      offerId: op.offerId().toString(),
    };
  }

  private parseCreatePassiveSellOffer(op: xdr.CreatePassiveSellOfferOp) {
    return {
      selling: parseAsset(op.selling()),
      buying: parseAsset(op.buying()),
      amount: op.amount().toString(),
      price: {
        n: op.price().n(),
        d: op.price().d(),
      },
    };
  }

  private parseSetOptions(op: xdr.SetOptionsOp) {
    return {
      inflationDest: op.inflationDest()
        ? parseAccountId(op.inflationDest()!)
        : undefined,
      clearFlags: op.clearFlags(),
      setFlags: op.setFlags(),
      masterWeight: op.masterWeight(),
      lowThreshold: op.lowThreshold(),
      medThreshold: op.medThreshold(),
      highThreshold: op.highThreshold(),
      homeDomain: op.homeDomain()?.toString(),
      signer: op.signer()
        ? {
            key: op.signer()!.key().value().toString("hex"),
            weight: op.signer()!.weight(),
          }
        : undefined,
    };
  }

  private parseChangeTrust(op: xdr.ChangeTrustOp) {
    return {
      line: parseChangeTrustAsset(op.line()),
      limit: op.limit().toString(),
    };
  }

  private parseAllowTrust(op: xdr.AllowTrustOp) {
    return {
      trustor: parseAccountId(op.trustor()),
      asset: op.asset().switch().name,
      authorize: op.authorize(),
    };
  }

  private parseAccountMerge(destination: xdr.MuxedAccount) {
    return {
      destination: parseMuxedAccount(destination),
    };
  }

  private parseManageData(op: xdr.ManageDataOp) {
    return {
      dataName: op.dataName().toString(),
      dataValue: op.dataValue() ? op.dataValue()!.toString("hex") : null,
    };
  }

  private parseBumpSequence(op: xdr.BumpSequenceOp) {
    return {
      bumpTo: op.bumpTo().toString(),
    };
  }

  private parseCreateClaimableBalance(op: xdr.CreateClaimableBalanceOp) {
    return {
      asset: parseAsset(op.asset()),
      amount: op.amount().toString(),
      claimants: op.claimants().map((c) => ({
        destination: parseAccountId(c.v0().destination()),
        predicate: c.v0().predicate(),
      })),
    };
  }

  private parseClaimClaimableBalance(op: xdr.ClaimClaimableBalanceOp) {
    return {
      balanceId: op.balanceId().value().toString("hex"),
    };
  }

  private parseBeginSponsoringFutureReserves(
    op: xdr.BeginSponsoringFutureReservesOp
  ) {
    return {
      sponsoredId: parseAccountId(op.sponsoredId()),
    };
  }

  private parseRevokeSponsorship(op: xdr.RevokeSponsorshipOp) {
    const type = op.switch().name;
    if (type === "revokeSponsorshipLedgerEntry") {
      return {
        type: "ledgerEntry",
        ledgerKey: op.ledgerKey(),
      };
    } else {
      return {
        type: "signer",
        signer: op.signer(),
      };
    }
  }

  private parseClawback(op: xdr.ClawbackOp) {
    return {
      asset: parseAsset(op.asset()),
      from: parseMuxedAccount(op.from()),
      amount: op.amount().toString(),
    };
  }

  private parseClawbackClaimableBalance(op: xdr.ClawbackClaimableBalanceOp) {
    return {
      balanceId: op.balanceId().value().toString("hex"),
    };
  }

  private parseSetTrustLineFlags(op: xdr.SetTrustLineFlagsOp) {
    return {
      trustor: parseAccountId(op.trustor()),
      asset: parseAsset(op.asset()),
      clearFlags: op.clearFlags(),
      setFlags: op.setFlags(),
    };
  }

  private parseLiquidityPoolDeposit(op: xdr.LiquidityPoolDepositOp) {
    const poolId = op.liquidityPoolId() as unknown as Uint8Array;
    const poolIdHex = Array.from(poolId)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return {
      liquidityPoolId: poolIdHex,
      maxAmountA: op.maxAmountA().toString(),
      maxAmountB: op.maxAmountB().toString(),
      minPrice: {
        n: op.minPrice().n(),
        d: op.minPrice().d(),
      },
      maxPrice: {
        n: op.maxPrice().n(),
        d: op.maxPrice().d(),
      },
    };
  }

  private parseLiquidityPoolWithdraw(op: xdr.LiquidityPoolWithdrawOp) {
    const poolId = op.liquidityPoolId() as unknown as Uint8Array;
    const poolIdHex = Array.from(poolId)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return {
      liquidityPoolId: poolIdHex,
      amount: op.amount().toString(),
      minAmountA: op.minAmountA().toString(),
      minAmountB: op.minAmountB().toString(),
    };
  }

  private parseInvokeHostFunction(op: xdr.InvokeHostFunctionOp) {
    return {
      hostFunction: op.hostFunction(),
      auth: op.auth(),
    };
  }

  private parseExtendFootprintTtl(op: xdr.ExtendFootprintTtlOp) {
    return {
      extendTo: op.extendTo(),
    };
  }

  private parseRestoreFootprint(_op: xdr.RestoreFootprintOp) {
    return {}; // No fields in RestoreFootprintOp
  }

  /**
   * Get the transaction this operation belongs to
   */
  get parentTransaction(): Transaction {
    return this.transaction;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      index: this.index,
      type: this.type,
      sourceAccount: this.sourceAccount,
      body: this.body,
    };
  }
}
