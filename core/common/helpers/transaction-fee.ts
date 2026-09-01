import { Transaction, xdr } from "stellar-sdk";
import type { TransactionFee } from "@/common/types/transaction-config/types.ts";

export const MINIMUM_BASE_FEE = 100n;
export const MAXIMUM_TRANSACTION_FEE = 0xffff_ffffn;

export type TransactionFeeMode = keyof TransactionFee;

export type ParsedTransactionFee = {
  mode: TransactionFeeMode;
  amount: bigint;
};

export type TransactionFeeParseError =
  | { reason: "invalid-configuration" }
  | { reason: "invalid-amount"; mode: TransactionFeeMode; value: unknown };

export type TransactionFeeParseResult =
  | { ok: true; value: ParsedTransactionFee }
  | { ok: false; error: TransactionFeeParseError };

const TRANSACTION_FEE_MODES = ["base", "inclusion", "max"] as const;

export const parseTransactionFee = (
  fee: unknown,
): TransactionFeeParseResult => {
  if (!fee || typeof fee !== "object" || Array.isArray(fee)) {
    return { ok: false, error: { reason: "invalid-configuration" } };
  }

  const keys = Object.keys(fee);
  if (
    keys.length !== 1 ||
    !TRANSACTION_FEE_MODES.includes(keys[0] as TransactionFeeMode)
  ) {
    return { ok: false, error: { reason: "invalid-configuration" } };
  }

  const mode = keys[0] as TransactionFeeMode;
  const value = (fee as Record<TransactionFeeMode, unknown>)[mode];
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return { ok: false, error: { reason: "invalid-amount", mode, value } };
  }

  return { ok: true, value: { mode, amount: BigInt(value) } };
};

export const getTransactionResourceFee = (
  transaction: Transaction,
): bigint =>
  transaction.tx.ext.type === "sorobanData"
    ? transaction.tx.ext.sorobanData.resourceFee
    : 0n;

export const getTransactionInclusionFee = (
  transaction: Transaction,
): bigint => BigInt(transaction.fee) - getTransactionResourceFee(transaction);

export const setTransactionFee = (
  transaction: Transaction,
  fee: bigint,
): Transaction => {
  const current = transaction.tx;
  const envelope = current instanceof xdr.Transaction
    ? xdr.TransactionEnvelope.envelopeTypeTx(
      new xdr.TransactionV1Envelope({
        tx: new xdr.Transaction({
          sourceAccount: current.sourceAccount,
          fee: Number(fee),
          seqNum: current.seqNum,
          cond: current.cond,
          memo: current.memo,
          operations: current.operations,
          ext: current.ext,
        }),
        signatures: transaction.signatures,
      }),
    )
    : xdr.TransactionEnvelope.envelopeTypeTxV0(
      new xdr.TransactionV0Envelope({
        tx: new xdr.TransactionV0({
          sourceAccountEd25519: current.sourceAccountEd25519,
          fee: Number(fee),
          seqNum: current.seqNum,
          timeBounds: current.timeBounds,
          memo: current.memo,
          operations: current.operations,
          ext: current.ext,
        }),
        signatures: transaction.signatures,
      }),
    );

  return new Transaction(envelope, transaction.networkPassphrase);
};
